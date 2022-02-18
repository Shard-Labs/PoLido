import hardhat, { ethers, upgrades } from "hardhat";
import {
    NodeOperatorRegistry__factory
} from "../../typechain";
import { exportAddresses, getUpgradeContext } from "../utils";

const upgradeNodeOperatorRegistry = async () => {
    const { network, filePath, deployDetails } = getUpgradeContext(hardhat);

    console.log("Start upgrade contract on:", network);
    const nodeOperatorRegistryAddress = deployDetails.node_operator_registry_proxy;
    const nodeOperatorRegistryFactory: NodeOperatorRegistry__factory = (
        await ethers.getContractFactory("NodeOperatorRegistry")
    ) as NodeOperatorRegistry__factory;

    await upgrades.upgradeProxy(nodeOperatorRegistryAddress, nodeOperatorRegistryFactory);
    const nodeOperatorRegistryImplAddress = await upgrades.erc1967.getImplementationAddress(
        nodeOperatorRegistryAddress
    );
    console.log("NodeOperatorRegistry upgraded");
    console.log("proxy:", nodeOperatorRegistryAddress);
    console.log("Implementation:", nodeOperatorRegistryImplAddress);

    exportAddresses(filePath, {
        node_operator_registry_proxy: nodeOperatorRegistryAddress,
        node_operator_registry_implementation: nodeOperatorRegistryImplAddress
    });
};

upgradeNodeOperatorRegistry();
