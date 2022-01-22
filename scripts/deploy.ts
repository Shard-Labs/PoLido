import hardhat, { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";
import {
    ValidatorFactory__factory,
    NodeOperatorRegistry__factory,
    NodeOperatorRegistry,
    StMATIC__factory,
    Validator__factory,
    PoLidoNFT__factory
} from "../typechain";

import { DeployDetails } from "./types";
import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";

const saveDeploymentDetails = (data: any, networkName: string) => {
    const filePath = path.join(process.cwd(), "deploy-" + networkName + ".json");
    const oldData: DeployDetails = JSON.parse(
        fs.readFileSync(filePath, { encoding: "utf-8" })
    );

    fs.writeFileSync(
        filePath,
        JSON.stringify({ ...oldData, ...data }, null, 4),
        "utf8"
    );
};

const getDeploymentData = (networkName: string) => {
    const configData: string = fs.readFileSync(
        path.join(process.cwd(), "config.json"),
        "utf-8"
    );

    return JSON.parse(configData).networks[networkName];
};

const deployValidator = async () => {
    const Validator = (await getContractFactory(
        "Validator"
    )) as Validator__factory;

    const validator = await Validator.deploy();
    await validator.deployed();

    return validator;
};

const deployValidatorFactory = async () => {
    const ValidatorFactory = (await getContractFactory(
        "ValidatorFactory"
    )) as ValidatorFactory__factory;

    const validatorFactory = await ValidatorFactory.deploy();
    await validatorFactory.deployed();

    return validatorFactory;
};

const deployNodeOperatorRegistry = async (
    validatorFactoryAddress: string,
    stakeManagerAddress: string,
    maticTokenAddress: string
) => {
    const NodeOperatorRegistry = (await getContractFactory(
        "NodeOperatorRegistry"
    )) as NodeOperatorRegistry__factory;

    const nodeOperatorRegistry = (await upgrades.deployProxy(
        NodeOperatorRegistry,
        [validatorFactoryAddress, stakeManagerAddress, maticTokenAddress]
    )) as NodeOperatorRegistry;
    await nodeOperatorRegistry.deployed();

    return nodeOperatorRegistry;
};

const deployPoLidoNFT = async () => {
    const PoLidoNFT = (await getContractFactory(
        "PoLidoNFT"
    )) as PoLidoNFT__factory;
    const poLidoNFT = await upgrades.deployProxy(PoLidoNFT, ["PoLido", "PLO"]);
    await poLidoNFT.deployed();

    return poLidoNFT;
};

const deployStMATIC = async (
    nodeOperatorRegistryAddress: string,
    maticTokenAddress: string,
    daoAddress: string,
    insuranceAddress: string,
    stakeManagerAddress: string,
    poLidoNFTAddress: string
) => {
    const StMATIC = (await getContractFactory("StMATIC")) as StMATIC__factory;
    const stMATIC = await upgrades.deployProxy(StMATIC, [
        nodeOperatorRegistryAddress,
        maticTokenAddress,
        daoAddress,
        insuranceAddress,
        stakeManagerAddress,
        poLidoNFTAddress
    ]);

    await stMATIC.deployed();

    return stMATIC;
};

async function main () {
    const [signer] = await ethers.getSigners();
    const networkName = hardhat.network.name;
    const config = getDeploymentData(networkName);

    const stakeManagerAddress = config.StakeManagerProxy;
    const maticTokenAddress = config.Token;
    const daoAddress = config.dao;
    const insuranceAddress = config.insurance;
    const treasuryAddress = config.treasury;

    console.log("Starting deployment on:", networkName);

    const validator = await deployValidator();
    console.log("Validator contract deployed to:", validator.address);

    const validatorFactory = await deployValidatorFactory();
    console.log(
        "ValidatorFactory proxy contract deployed to:",
        validatorFactory.address
    );

    const nodeOperatorRegistry = await deployNodeOperatorRegistry(
        validatorFactory.address,
        stakeManagerAddress,
        maticTokenAddress
    );
    console.log(
        "NodeOperatorRegistry contract deployed to:",
        nodeOperatorRegistry.address
    );

    console.log("Deploying PoLidoNFT...");
    const poLidoNFT = await deployPoLidoNFT();

    console.log("PoLidoNFT contract deployed to:", poLidoNFT.address);

    // deploy stMATIC contract
    const stMATIC = await deployStMATIC(
        nodeOperatorRegistry.address,
        maticTokenAddress,
        daoAddress,
        insuranceAddress,
        stakeManagerAddress,
        poLidoNFT.address
    );

    // await stMATIC.setFxStateRootTunnel(
    //     GOERLI_DEPLOYMENT_DETAILS.fx_state_root_tunnel
    // );

    console.log("StMATIC contract deployed to:", stMATIC.address);

    // set operator address for the validator factory
    await validatorFactory.setOperator(
        nodeOperatorRegistry.address
    );
    console.log("validatorFactory operator set");

    // set stMATIC contract fot the operator
    await nodeOperatorRegistry.setStMATIC(stMATIC.address);
    console.log("NodeOperatorRegistry stMATIC set");

    // set stMATIC contract fot the PoLidoNFT
    await poLidoNFT.setStMATIC(stMATIC.address);
    console.log("PoLidoNFT stMATIC set");

    // configure root tunnel
    // const fxStateRootTunnel = (await ethers.getContractAt(
    //     "IFxStateRootTunnel",
    //     GOERLI_DEPLOYMENT_DETAILS.fx_state_root_tunnel
    // )) as FxStateRootTunnel;

    // await fxStateRootTunnel.setFxChildTunnel(
    //     GOERLI_DEPLOYMENT_DETAILS.fx_state_child_tunnel
    // );
    // await fxStateRootTunnel.setStMATIC(stMATIC.address);
    const data = {
        network: networkName,
        signer: signer.address,
        dao: daoAddress,
        treasury: treasuryAddress,
        matic_erc20_address: maticTokenAddress,
        matic_stake_manager_proxy: stakeManagerAddress,
        lido_nft_proxy: poLidoNFT.address,
        stMATIC_proxy: stMATIC.address,
        validator_factory_proxy: validatorFactory.address,
        node_operator_registry_proxy: nodeOperatorRegistry.address
    };

    saveDeploymentDetails(data, networkName);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
