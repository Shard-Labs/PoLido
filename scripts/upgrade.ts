import hardhat, { ethers, upgrades } from "hardhat";
import {
    ValidatorFactory
} from "../typechain";
import fs from "fs";
import path from "path";
import { DeployDetails } from "./types";

const main = async () => {
    const network = hardhat.network.name;
    const fileName = `deploy-${network}.json`;
    const DEPLOYMENT_DETAILS: DeployDetails = require(path.join("..", fileName));

    // console.log("Start upgrade contracts on:", network);
    // const stMATICAddress = DEPLOYMENT_DETAILS.stMATIC_proxy;
    // const StMATICFactory = await ethers.getContractFactory("StMATIC");
    // const stMATIC = await upgrades.upgradeProxy(stMATICAddress, StMATICFactory);
    // const stMATICImplAddress = await upgrades.erc1967.getImplementationAddress(
    //     stMATIC.address
    // );
    // console.log("StMATIC upgraded");
    // console.log("proxy:", stMATIC.address);
    // console.log("Implementation:", stMATICImplAddress);

    // const lidoNFTAddress = DEPLOYMENT_DETAILS.lido_nft_proxy;
    // // const lidoNFTFactory = await ethers.getContractFactory("PoLidoNFT");
    // // const lidoNFT = await upgrades.upgradeProxy(lidoNFTAddress, lidoNFTFactory);
    // const lidoNFTImplAddress = await upgrades.erc1967.getImplementationAddress(
    //     lidoNFTAddress
    // );
    // console.log("Lido NFT upgraded");
    // console.log("proxy:", lidoNFTAddress);
    // console.log("Implementation:", lidoNFTImplAddress);

    const nodeOperatorRegistryAddress = DEPLOYMENT_DETAILS.node_operator_registry_proxy;
    const nodeOperatorRegistryFactory = await ethers.getContractFactory("NodeOperatorRegistry");
    await upgrades.upgradeProxy(nodeOperatorRegistryAddress, nodeOperatorRegistryFactory);
    const nodeOperatorRegistryImplAddress = await upgrades.erc1967.getImplementationAddress(
        nodeOperatorRegistryAddress
    );
    console.log("NodeOperatorRegistry upgraded");
    console.log("proxy:", nodeOperatorRegistryAddress);
    console.log("Implementation:", nodeOperatorRegistryImplAddress);

    // const validatorFactoryAddress = DEPLOYMENT_DETAILS.validator_factory_proxy;
    // const validatorFactoryFactory = await ethers.getContractFactory("ValidatorFactory");
    // const validatorFactory = (await upgrades.upgradeProxy(validatorFactoryAddress, validatorFactoryFactory)) as ValidatorFactory;
    // const validatorFactoryImplAddress = await upgrades.erc1967.getImplementationAddress(
    //     validatorFactory.address
    // );
    // console.log("ValidatorFactory upgraded");
    // console.log("proxy:", validatorFactory.address);
    // console.log("Implementation:", validatorFactoryImplAddress);

    // const validatorFactory = (await ethers.getContractAt("ValidatorFactory", validatorFactoryAddress)) as ValidatorFactory;
    // const validator = await (await ethers.getContractFactory("Validator")).deploy();
    // console.log("Validator implementation deployed:", validator.address);

    // console.log("update validator proxies implementation");
    // await validatorFactory.setValidatorImplementation(validator.address);

    // console.log("Export to file...");
    // const data = JSON.parse(fs.readFileSync(fileName, "utf8"));
    // fs.writeFileSync(fileName, JSON.stringify({
    //     ...data,
    //     lido_nft_implementation: lidoNFTImplAddress,
    //     stMATIC_implementation: stMATICImplAddress,
    //     node_operator_registry_implementation: nodeOperatorRegistryImplAddress
    //     // validator_factory_implementation: validatorFactoryImplAddress,
    //     // validator_implementation: validator.address
    // }));

    console.log("Done!!");
};

main();
