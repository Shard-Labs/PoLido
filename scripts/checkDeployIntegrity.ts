import hardhat, { ethers } from "hardhat";
import {
    NodeOperatorRegistry,
    PoLidoNFT,
    StMATIC,
    ValidatorFactory,
    FxStateRootTunnel
} from "../typechain";
import { getUpgradeContext } from "./utils";

const checkDeployIntegrity = async () => {
    const { deployDetails } = getUpgradeContext(hardhat);
    const nodeOperatorRegistry: NodeOperatorRegistry = (await ethers.getContractAt(
        "NodeOperatorRegistry",
        deployDetails.node_operator_registry_proxy)
    ) as NodeOperatorRegistry;

    const stMATIC: StMATIC = (await ethers.getContractAt(
        "StMATIC",
        deployDetails.stMATIC_proxy)
    ) as StMATIC;

    const poLidoNFT: PoLidoNFT = (await ethers.getContractAt(
        "PoLidoNFT",
        deployDetails.lido_nft_proxy)
    ) as PoLidoNFT;

    const validatorFactory: ValidatorFactory = (await ethers.getContractAt(
        "ValidatorFactory",
        deployDetails.validator_factory_proxy)
    ) as ValidatorFactory;

    const fxStateRootTunnel: FxStateRootTunnel = (await ethers.getContractAt(
        "FxStateRootTunnel",
        deployDetails.fx_state_root_tunnel)
    ) as FxStateRootTunnel;

    console.log("Checking contracts integrity...");

    const res = await nodeOperatorRegistry.getContracts();
    isValid(res._polygonERC20, deployDetails.matic_erc20_address, "NodeOperatorRegistry", "ERC20");
    isValid(res._stMATIC, deployDetails.stMATIC_proxy, "NodeOperatorRegistry", "StMATIC");
    isValid(res._stakeManager, deployDetails.matic_stake_manager_proxy, "NodeOperatorRegistry", "StakeManager");
    isValid(res._validatorFactory, deployDetails.validator_factory_proxy, "NodeOperatorRegistry", "validatorFactory");

    isValid(await validatorFactory.operatorRegistry(), deployDetails.node_operator_registry_proxy, "ValidatorFactory", "nodeOperatorRegistry");
    isValid(await validatorFactory.validatorImplementation(), deployDetails.validator_implementation, "ValidatorFactory", "validator");

    isValid(await poLidoNFT.stMATIC(), deployDetails.stMATIC_proxy, "PoLidoNFT", "stMATIC");

    isValid(await fxStateRootTunnel.stMATIC(), deployDetails.stMATIC_proxy, "fxStateRootTunnel", "stMATIC");
    isValid(await fxStateRootTunnel.fxChildTunnel(), deployDetails.fx_state_child_tunnel, "fxStateRootTunnel", "fx_state_child_tunnel");

    isValid(await stMATIC.nodeOperatorRegistry(), deployDetails.node_operator_registry_proxy, "stMATIC", "nodeOperatorRegistry");
    isValid(await stMATIC.token(), deployDetails.matic_erc20_address, "stMATIC", "matic_erc20_address");
    isValid(await stMATIC.dao(), deployDetails.dao, "stMATIC", "dao");
    isValid(await stMATIC.insurance(), deployDetails.treasury, "stMATIC", "treasury");
    isValid(await stMATIC.stakeManager(), deployDetails.matic_stake_manager_proxy, "stMATIC", "matic_stake_manager_proxy");
    isValid(await stMATIC.poLidoNFT(), deployDetails.lido_nft_proxy, "stMATIC", "lido_nft_proxy");
    isValid(await stMATIC.fxStateRootTunnel(), deployDetails.fx_state_root_tunnel, "stMATIC", "fx_state_root_tunnel");

    console.log("All is Good :)");
};

const isValid = (actual: string, target: string, contract: string, message: string) => {
    if (actual.toLowerCase() !== target.toLowerCase()) {
        console.log("actual:", actual);
        console.log("target:", target);
        throw new Error(`Error: ${contract}--Invalid address--${message}`);
    }
};

checkDeployIntegrity();
