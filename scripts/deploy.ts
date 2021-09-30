import hardhat, { ethers, upgrades } from 'hardhat';
import { Signer } from 'ethers';
import fs from 'fs';
import path from 'path';
import { Artifact } from "hardhat/types";
import {
  ValidatorFactory,
  ValidatorFactory__factory,
  NodeOperatorRegistry__factory,
  NodeOperatorRegistry
} from '../typechain';
import config from "../config.json"

const { deployContract } = hardhat.waffle;

async function main() {
  const networkName: string = hardhat.network.name

  // matic token address
  const maticERC20Address: string =
    config.networks[networkName == "mainnet" ? "mainnet" : "goerli"].StakeManagerProxy

  // polygon stake manager address
  const polygonStakeManager: string =
    config.networks[networkName == "mainnet" ? "mainnet" : "goerli"].Token

  // get signer
  const accounts = await ethers.getSigners();
  let signer: Signer = accounts[0]
  let signerAddress = await signer.getAddress()

  // deploy validator implementation
  const validatorArtifact: Artifact = await hardhat.artifacts.readArtifact("Validator");
  const validatorContract: ValidatorFactory = (await deployContract(
    signer,
    validatorArtifact,
    []
  )) as ValidatorFactory

  // deploy validator factory
  const validatorFactoryArtifact: ValidatorFactory__factory =
    (await ethers.getContractFactory('ValidatorFactory')) as ValidatorFactory__factory

  const validatorFactoryContract: ValidatorFactory = (await upgrades.deployProxy(
    validatorFactoryArtifact,
    [validatorContract.address],
    { kind: 'uups' }
  )) as ValidatorFactory

  await validatorFactoryContract.deployed();

  //deploy node operator
  const nodeOperatorRegistryArtifact: NodeOperatorRegistry__factory = (
    await ethers.getContractFactory('NodeOperatorRegistry')
  ) as NodeOperatorRegistry__factory

  const nodeOperatorRegistryContract: NodeOperatorRegistry =
    (await upgrades.deployProxy(
      nodeOperatorRegistryArtifact,
      [
        validatorFactoryContract.address,
        polygonStakeManager,
        maticERC20Address
      ],
      { kind: 'uups' }
    )) as NodeOperatorRegistry

  await nodeOperatorRegistryContract.deployed();

  // deploy lido contract
  const LidoMatic = await ethers.getContractFactory('LidoMatic')
  const lidoMatic = await upgrades.deployProxy(LidoMatic, [
    nodeOperatorRegistryContract.address,
    maticERC20Address,
    config.dao,
  ]);

  await lidoMatic.deployed();

  // set operator address for the validator factory
  await validatorFactoryContract.setOperatorAddress(nodeOperatorRegistryContract.address)
  // set lido contract fot the operator
  await nodeOperatorRegistryContract.setLidoAddress(lidoMatic.address)

  // write addreses into json file
  const data = {
    signer: signerAddress,
    dao: config.dao,
    treasury: config.treasury,
    matic_erc20_address: maticERC20Address,
    matic_stake_manager_proxy: polygonStakeManager,
    lido_matic: lidoMatic.address,
    validator_implementation: validatorContract.address,
    validator_factory_proxy: validatorFactoryContract.address,
    node_operator_registry_proxy: nodeOperatorRegistryContract.address
  }

  fs.writeFileSync(
    path.join(process.cwd(), "deploy-" + networkName + ".json"),
    JSON.stringify(data, null, 4),
    "utf8"
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
