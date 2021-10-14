import { ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// In the future, select from different deployment details file based on the --network argument
// For now it is hardcoded to use only Goerli
import * as GOERLI_DEPLOYMENT_DETAILS from "../deploy-goerli.json";
import * as NodeOperatorRegistryJSON from "../artifacts/contracts/NodeOperatorRegistry.sol/NodeOperatorRegistry.json";
import { NodeOperatorRegistry } from "../typechain";
import { GoerliOverrides } from "./constants";

const verifyContract = async (
    hre: HardhatRuntimeEnvironment,
    contractAddress: string
) => {
    await hre.run("verify:verify", {
        address: contractAddress
    });
};

export const verify = async (hre: HardhatRuntimeEnvironment) => {
    const contracts = [
        GOERLI_DEPLOYMENT_DETAILS.lido_matic_implementation,
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_implementation,
        GOERLI_DEPLOYMENT_DETAILS.validator_factory_implementation
    ];

    for (const contract of contracts) {
        await verifyContract(hre, contract);
    }
};

export const addOperator = async (
    hre: HardhatRuntimeEnvironment,
    name: string,
    rewardAddress: string,
    pubKey: Uint8Array | string
) => {
    const [admin] = await hre.ethers.getSigners();
    const nodeOperatorRegistryAddress =
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy;

    const nodeOperatorRegistry = new ethers.Contract(
        nodeOperatorRegistryAddress,
        NodeOperatorRegistryJSON.abi,
        admin
    ) as NodeOperatorRegistry;

    await (
        await nodeOperatorRegistry.addOperator(name, rewardAddress, pubKey, GoerliOverrides)
    ).wait();
};

export const removeOperator = async (
    hre: HardhatRuntimeEnvironment,
    id: string
) => {
    const [admin] = await hre.ethers.getSigners();
    const nodeOperatorRegistryAddress =
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy;

    const nodeOperatorRegistry = new ethers.Contract(
        nodeOperatorRegistryAddress,
        NodeOperatorRegistryJSON.abi,
        admin
    ) as NodeOperatorRegistry;

    await (await nodeOperatorRegistry.removeOperator(id, GoerliOverrides)).wait();
};
