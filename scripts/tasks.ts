import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// In the future, select from different deployment details file based on the --network argument
// For now it is hardcoded to use only Goerli
import * as GOERLI_DEPLOYMENT_DETAILS from "../deploy-goerli.json";
import { GoerliOverrides, TokenAddresses } from "./constants";
import { attachContract } from "./utils";

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
        GOERLI_DEPLOYMENT_DETAILS.stMATIC_implementation,
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
    pubKey: Uint8Array | string,
    privateKey?: string
) => {
    const nodeOperatorRegistryAddress =
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy;

    const nodeOperatorRegistry = await attachContract(
        hre,
        nodeOperatorRegistryAddress,
        "NodeOperatorRegistry"
    );

    await (
        await nodeOperatorRegistry.addOperator(
            name,
            rewardAddress,
            pubKey,
            GoerliOverrides
        )
    ).wait();
};

export const removeOperator = async (
    hre: HardhatRuntimeEnvironment,
    id: string,
    privateKey?: string
) => {
    const nodeOperatorRegistryAddress =
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy;

    const nodeOperatorRegistry = await attachContract(
        hre,
        nodeOperatorRegistryAddress,
        "NodeOperatorRegistry"
    );

    await (
        await nodeOperatorRegistry.removeOperator(id, GoerliOverrides)
    ).wait();
};

export const stakeOperator = async (
    hre: HardhatRuntimeEnvironment,
    amount: BigNumber,
    heimdallFee: BigNumber,
    privateKey?: string
) => {
    const nodeOperatorRegistryAddress =
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy;

    const token = await attachContract(
        hre,
        TokenAddresses.Testv4,
        "ERC20",
        privateKey
    );
    const nodeOperatorRegistry = await attachContract(
        hre,
        nodeOperatorRegistryAddress,
        "NodeOperatorRegistry",
        privateKey
    );
    const operator = await nodeOperatorRegistry.getNodeOperator(1, false);

    await token.approve(operator[6], amount.add(heimdallFee));
    await (await nodeOperatorRegistry.stake(amount, heimdallFee)).wait();
};

export const unstakeOperator = async (hre: HardhatRuntimeEnvironment) => {
    const nodeOperatorRegistryAddress =
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy;

    const nodeOperatorRegistry = await attachContract(
        hre,
        nodeOperatorRegistryAddress,
        "NodeOperatorRegistry"
    );

    await (await nodeOperatorRegistry.unstake()).wait();

    console.log("unstakeOperator done");
};

export const claimUnstakeOperator = async (hre: HardhatRuntimeEnvironment) => {
    const nodeOperatorRegistryAddress =
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy;

    const nodeOperatorRegistry = await attachContract(
        hre,
        nodeOperatorRegistryAddress,
        "NodeOperatorRegistry"
    );

    await (await nodeOperatorRegistry.unstakeClaim()).wait();

    console.log("claimUnstakeOperator done");
};

export const getValidatorDetails = async (
    hre: HardhatRuntimeEnvironment,
    validatorID: number
) => {
    const stakeManagerAddress =
        GOERLI_DEPLOYMENT_DETAILS.matic_stake_manager_proxy;

    if (validatorID === 0) {
        console.log("validator id not valid");
    }

    const stakeManagerArtifact = await hre.artifacts.readArtifact(
        "IStakeManager"
    );
    const stakeManagerContract = await hre.ethers.getContractAt(
        stakeManagerArtifact.abi,
        stakeManagerAddress
    );

    const v = await stakeManagerContract.validators(validatorID);
    const epoch = await stakeManagerContract.epoch();
    const withdrawalDelay = await stakeManagerContract.withdrawalDelay();

    console.log("Validator:");
    console.log("-----------------------------------------");
    console.log("amount:", v.amount.toString());
    console.log("activationEpoch:", v.activationEpoch.toString());
    console.log("deactivationEpoch:", v.deactivationEpoch.toString());
    console.log("reward:", v.reward.toString());
    console.log("jailTime:", v.jailTime.toString());
    console.log("signer:", v.signer.toString());
    console.log("contractAddress:", v.contractAddress.toString());
    console.log("status:", v.status.toString());
    console.log("commissionRate:", v.commissionRate.toString());
    console.log("lastCommissionUpdate:", v.lastCommissionUpdate.toString());
    console.log("delegatorsReward:", v.delegatorsReward.toString());
    console.log("delegatedAmount:", v.delegatedAmount.toString());
    console.log("initialRewardPerStake:", v.initialRewardPerStake.toString());
    console.log();
    console.log("WithdrawalDelay:", withdrawalDelay.toString());
    console.log("Current Epoch:", epoch.toString());
    console.log("-----------------------------------------");
    if (v.deactivationEpoch !== hre.ethers.BigNumber.from(0)) {
        console.log(
            "Can claim unstaked tokens after:",
            v.deactivationEpoch.add(withdrawalDelay).toString()
        );
    }
};
