import * as fs from "fs";
import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { Contract, Wallet } from "ethers";
import { upgrades } from "hardhat";

import { getContractAddress } from "./utils";
import {
    FxStateChildTunnel,
    FxStateRootTunnel,
    NodeOperatorRegistry,
    PoLidoNFT,
    StMATIC,
    Validator,
    ValidatorFactory
} from "../typechain";
import {
    CHECKPOINT_MANAGER,
    DAO,
    FX_ROOT,
    INSURANCE,
    MAINNET_MATIC_TOKEN,
    POLYGON_STAKE_MANAGER
} from "../environment";
import path from "path/posix";

type DeploymentData = {
  Network: string;
  Signer: string;
  Dao: string;
  Treasury: string;
  PoLidoNFT: string;
  StMATIC: string;
  ValidatorFactory: string;
  Validator: string;
  NodeOperatorRegistry: string;
  FxStateRootTunnel: string;
  FxStateChildTunnel: string;
};

type ContractNames =
  | "Validator"
  | "ValidatorFactory"
  | "NodeOperatorRegistry"
  | "PoLidoNFT"
  | "FxStateRootTunnel"
  | "StMATIC"
  | "FxStateChildTunnel";

type RootContractNames = Exclude<ContractNames, "FxStateChildTunnel">;
type ChildContractNames = Extract<ContractNames, "FxStateChildTunnel">;
type ChildDeploymentOrder = Record<ChildContractNames, number>;
type RootDeploymentOrder = Record<RootContractNames, number>;

const childDeploymentOrder: ChildDeploymentOrder = {
    FxStateChildTunnel: 1
};

const rootDeploymentOrder: RootDeploymentOrder = {
    Validator: 1,
    ValidatorFactory: 2,
    NodeOperatorRegistry: 3,
    PoLidoNFT: 4,
    FxStateRootTunnel: 5,
    StMATIC: 6
};

interface Exportable {
  data: Record<any, string>;

  export(): void;
}

abstract class MultichainDeployer {
  childSigner: Wallet;
  rootSigner: Wallet;

  childNonce: number;
  rootNonce: number;

  deploymentData: Partial<DeploymentData>;

  protected constructor (
      childSigner: Wallet,
      childNonce: number,
      rootSigner: Wallet,
      rootNonce: number
  ) {
      this.childSigner = childSigner;
      this.rootSigner = rootSigner;
      this.childNonce = childNonce;
      this.rootNonce = rootNonce;

      this.deploymentData = {};
  }

  protected deployContractRoot = async <T extends Contract>(
      contractName: keyof DeploymentData
  ) => {
      const Contract = await getContractFactory(contractName, this.rootSigner);
      const contract = (await Contract.deploy()) as T;
      await contract.deployed();

      this.deploymentData[contractName] = contract.address;
      this.rootNonce++;

      return contract;
  };

  protected deployContractChild = async <T extends Contract>(
      contractName: keyof DeploymentData
  ) => {
      const Contract = await getContractFactory(contractName, this.childSigner);
      const contract = (await Contract.deploy()) as T;
      await contract.deployed();

      this.deploymentData[contractName] = contract.address;
      this.childNonce++;

      return contract;
  };

  protected deployProxyRoot = async <T extends Contract>(
      contractName: keyof DeploymentData,
      ...args: any[]
  ) => {
      const Contract = await getContractFactory(contractName, this.rootSigner);
      const contract = (await upgrades.deployProxy(Contract, args)) as T;
      await contract.deployed();

      this.deploymentData[contractName] = contract.address;
      this.rootNonce++;

      return contract;
  };

  protected deployProxyChild = async <T extends Contract>(
      contractName: keyof DeploymentData,
      ...args: any[]
  ) => {
      const Contract = await getContractFactory(contractName, this.childSigner);
      const contract = (await upgrades.deployProxy(Contract, args)) as T;
      await contract.deployed();

      this.deploymentData[contractName] = contract.address;
      this.rootNonce++;

      return contract;
  };
}

export class PoLidoDeployer extends MultichainDeployer implements Exportable {
  data!: Record<ContractNames, string>;

  public static CreatePoLidoDeployer = async (
      childSigner: Wallet,
      rootSigner: Wallet
  ) => {
      const childNonce = await childSigner.getTransactionCount();
      const rootNonce = await rootSigner.getTransactionCount();
      const poLidoDeployer = new PoLidoDeployer(
          childSigner,
          childNonce,
          rootSigner,
          rootNonce
      );

      poLidoDeployer.calculateContractAddresses();
      return poLidoDeployer;
  };

  deploy = async () => {
      await this.deployValidator();
      await this.deployValidatorFactory();
      await this.deployNodeOperatorRegistry();
      await this.deployPoLidoNFT();
      await this.deployFxStateRootTunnel();
      await this.deployFxStateChildTunnel();
      await this.deployStMATIC();
  };

  private deployValidator = async () => {
      return await this.deployContractRoot<Validator>("Validator");
  };

  private deployValidatorFactory = async () => {
      return await this.deployProxyRoot<ValidatorFactory>("ValidatorFactory", [
          this.deploymentData.Validator,
          this.data.NodeOperatorRegistry
      ]);
  };

  private deployNodeOperatorRegistry = async () => {
      return await this.deployProxyRoot<NodeOperatorRegistry>(
          "NodeOperatorRegistry",
          [
              this.data.ValidatorFactory,
              POLYGON_STAKE_MANAGER,
              MAINNET_MATIC_TOKEN,
              this.data.StMATIC
          ]
      );
  };

  private deployPoLidoNFT = async () => {
      return await this.deployProxyRoot<PoLidoNFT>("PoLidoNFT", [
          "PoLido",
          "PLO",
          this.data.StMATIC
      ]);
  };

  private deployFxStateRootTunnel = async () => {
      return await this.deployProxyRoot<FxStateRootTunnel>("FxStateRootTunnel", [
          CHECKPOINT_MANAGER,
          FX_ROOT,
          this.data.FxStateChildTunnel,
          this.data.StMATIC
      ]);
  };

  private deployFxStateChildTunnel = async () => {
      return await this.deployProxyChild<FxStateChildTunnel>(
          "FxStateChildTunnel",
          [this.data.FxStateRootTunnel]
      );
  };

  private deployStMATIC = async () => {
      return await this.deployProxyRoot<StMATIC>("StMATIC", [
          this.data.NodeOperatorRegistry,
          MAINNET_MATIC_TOKEN,
          DAO,
          INSURANCE,
          POLYGON_STAKE_MANAGER,
          this.data.PoLidoNFT,
          this.data.FxStateRootTunnel
      ]);
  };

  export = () => {
      const filePath = path.join(
          process.cwd(),
          "deploy-" + this.rootSigner.address + ".json"
      );
      const oldData: DeploymentData = JSON.parse(
          fs.readFileSync(filePath, { encoding: "utf-8" })
      );

      fs.writeFileSync(
          filePath,
          JSON.stringify({ ...oldData, ...this.data }, null, 4),
          "utf8"
      );
  };

  private calculateContractAddresses = () => {
      this.calculateRootContractAddresses();
      this.calculateChildContractAddresses();
  };

  private calculateRootContractAddresses = () => {
      (Object.keys(rootDeploymentOrder) as Array<RootContractNames>).forEach(
          (k) => {
              this.data[k] = getContractAddress(
                  this.rootSigner.address,
                  this.rootNonce + rootDeploymentOrder[k]
              );
          }
      );
  };

  private calculateChildContractAddresses = () => {
      (Object.keys(childDeploymentOrder) as Array<ChildContractNames>).forEach(
          (k) => {
              this.data[k] = getContractAddress(
                  this.childSigner.address,
                  this.childNonce + childDeploymentOrder[k]
              );
          }
      );
  };
}
