import hardhat, { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";
import {
    ValidatorFactory__factory,
    NodeOperatorRegistry__factory,
    NodeOperatorRegistry,
    StMATIC__factory,
    Validator__factory,
    PoLidoNFT__factory,
    FxStateRootTunnel__factory,
    FxStateChildTunnel__factory
} from "../typechain";

import { DeployDetails } from "./types";
import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const getContractAddress = (address: string, nonce: number) => {
    const rlpEncoded = ethers.utils.RLP.encode([
        address,
        ethers.BigNumber.from(nonce.toString()).toHexString()
    ]);
    const contractAddressLong = ethers.utils.keccak256(rlpEncoded);
    const contractAddress = "0x".concat(contractAddressLong.substring(26));

    return ethers.utils.getAddress(contractAddress);
};

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
    poLidoNFTAddress: string,
    fxStateRootTunnelAddress: string
) => {
    const StMATIC = (await getContractFactory("StMATIC")) as StMATIC__factory;

    const stMATIC = await upgrades.deployProxy(StMATIC, [
        nodeOperatorRegistryAddress,
        maticTokenAddress,
        daoAddress,
        insuranceAddress,
        stakeManagerAddress,
        poLidoNFTAddress,
        fxStateRootTunnelAddress
    ]);
    await stMATIC.deployed();

    return stMATIC;
};

const deployFxStateRoot = async (
    signer: SignerWithAddress
) => {
    const nonce = await signer.getTransactionCount();
    const fxChildTunnelAddress = getContractAddress(signer.address, nonce + 1);
    const stMATICAddress = getContractAddress(signer.address, nonce + 2);
    const checkpointManagerAddress = process.env.CHECKPOINT_MANAGER;
    const fxRootAddress = process.env.FX_ROOT;

    const FxStateRootTunnel = (await getContractFactory(
        "FxStateRootTunnel"
    )) as FxStateRootTunnel__factory;

    const fxStateRootTunnel = await FxStateRootTunnel.deploy(
    checkpointManagerAddress!,
    fxRootAddress!,
    fxChildTunnelAddress,
    stMATICAddress
    );
    await fxStateRootTunnel.deployed();

    return fxStateRootTunnel;
};

const deployFxStateChild = async (fxStateRootTunnel: string) => {
    const fxChildAddress = process.env.FX_CHILD;

    const FxStateChildTunnel = (await getContractFactory(
        "FxStateChildTunnel"
    )) as FxStateChildTunnel__factory;
    const fxStateChildTunnel = await FxStateChildTunnel.deploy(
    fxChildAddress!,
    fxStateRootTunnel
    );
    await fxStateChildTunnel.deployed();

    return fxStateChildTunnel;
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

    const poLidoNFT = await deployPoLidoNFT();
    console.log("PoLidoNFT contract deployed to:", poLidoNFT.address);

    const fxStateRootTunnel = await deployFxStateRoot(signer);
    console.log("FxStateRoot contract deployed to:", fxStateRootTunnel.address);

    const fxStateChildTunnel = await deployFxStateChild(fxStateRootTunnel.address);
    console.log("FxStateChild contract deployed to:", fxStateChildTunnel.address);

    // deploy stMATIC contract
    const stMATIC = await deployStMATIC(
        nodeOperatorRegistry.address,
        maticTokenAddress,
        daoAddress,
        insuranceAddress,
        stakeManagerAddress,
        poLidoNFT.address,
        fxStateRootTunnel.address
    );
    console.log("StMATIC contract deployed to:", stMATIC.address);

    // set operator address for the validator factory
    await validatorFactory.setOperator(nodeOperatorRegistry.address);
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
