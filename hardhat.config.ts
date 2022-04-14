import { HardhatRuntimeEnvironment } from "hardhat/types";
import { HardhatUserConfig, task } from "hardhat/config";

import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-etherscan";
// import "hardhat-gas-reporter";
import "@openzeppelin/hardhat-defender";
// import "hardhat-contract-sizer";

import {
    verify,
    addOperator,
    removeOperator,
    stakeOperator,
    unstakeOperator,
    claimUnstakeOperator,
    getValidatorDetails
} from "./scripts/tasks";
import { OperatorArgs } from "./scripts/types";
import { getPublicKey } from "./scripts/utils";
import {
    DEPLOYER_PRIVATE_KEY,
    ETHERSCAN_API_KEY,
    ROOT_CHAIN_RPC,
    ROOT_GAS_LIMIT,
    ROOT_GAS_PRICE,
    VALIDATOR_PRIVATE_KEY,
    DEFENDER_TEAM_API_KEY,
    DEFENDER_TEAM_API_SECRET_KEY
} from "./environment";

task("verifyLido", "StMATIC contracts verification").setAction(
    async (args, hre: HardhatRuntimeEnvironment) => {
        await verify(hre);
    }
);

task("addOperator", "Assigns an operator")
    .addParam("operatorName", "Name of the new operator")
    .addParam("rewardAddress", "Reward address of the new operator")
    .addOptionalParam("pubKey", "Public key of the validator")
    .addOptionalParam("privateKey", "Private key of stMATIC admin")
    .setAction(async (args: OperatorArgs, hre: HardhatRuntimeEnvironment) => {
        const { operatorName, rewardAddress, privateKey } = args;
        const pubKey = args.pubKey || getPublicKey(VALIDATOR_PRIVATE_KEY);

        await addOperator(hre, operatorName, rewardAddress, pubKey, privateKey);
    });

task("removeOperator", "Removes an operator")
    .addParam("id", "Id of an operator that will be removed")
    .addOptionalParam("privateKey", "Private key of stMATIC admin")
    .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
        const { id, privateKey } = args;
        await removeOperator(hre, id, privateKey);
    });

task("stakeOperator", "Stakes a Operator")
    .addParam("amount", "Amount that will be staked")
    .addParam("heimdallFee", "Heimdall fee")
    .addOptionalParam("privateKey", "Private key of Operator owner")
    .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
        const { amount, heimdallFee, privateKey } = args;
        const amountWei = hre.ethers.utils.parseEther(amount);
        const heimdallFeeWei = hre.ethers.utils.parseEther(heimdallFee);

        await stakeOperator(hre, amountWei, heimdallFeeWei, privateKey);
    });

task("unstakeOperator", "Unstake an Operator").setAction(
    async (args, hre: HardhatRuntimeEnvironment) => {
        await unstakeOperator(hre);
    }
);

task(
    "claimUnstakeOperator",
    "claim staked Matics by the Operator on stakeManager"
).setAction(async (args, hre: HardhatRuntimeEnvironment) => {
    await claimUnstakeOperator(hre);
});

task("getValidatorDetails", "Get validator details on Polygon stake manager")
    .addParam("id", "validator id")
    .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
        const { id } = args;
        await getValidatorDetails(hre, Number(id));
    });

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    solidity: {
        version: "0.8.7",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    networks: {
        localhost: {
            url: "http://127.0.0.1:8545"
        },
        testnet: {
            url: ROOT_CHAIN_RPC,
            accounts: [DEPLOYER_PRIVATE_KEY],
            gasPrice: Number(ROOT_GAS_PRICE),
            gas: Number(ROOT_GAS_LIMIT)
        },
        mainnet: {
            url: ROOT_CHAIN_RPC,
            accounts: [DEPLOYER_PRIVATE_KEY],
            gasPrice: Number(ROOT_GAS_PRICE),
            gas: Number(ROOT_GAS_LIMIT)
        }
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v5"
    },
    mocha: {
        timeout: 100000
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY
    },
    defender: {
        apiKey: DEFENDER_TEAM_API_KEY,
        apiSecret: DEFENDER_TEAM_API_SECRET_KEY
    }
};

export default config;
