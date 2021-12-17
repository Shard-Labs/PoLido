import * as dotenv from "dotenv";
import * as path from "path";
import { HardhatUserConfig, task } from "hardhat/config";

import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-etherscan";
// import "hardhat-gas-reporter";
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
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { OperatorArgs } from "./scripts/types";
import { getPublicKey } from "./scripts/utils";

dotenv.config({ path: path.join(__dirname, ".env") });

// Used to bypass hardhat compilation error in case user doesn't use one of the private keys
const DEFAULT_PRIVATE_KEY =
  "ab776418850f4b06cba804f364aeba754f29f5164de6c068dc85f3091253faf0";

const INFURA_API_KEY = process.env.INFURA_API_KEY;
const GOERLI_PRIVATE_KEY = process.env.GOERLI_PRIVATE_KEY;
const MAINNET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const VALIDATOR_PRIVATE_KEY = process.env.VALIDATOR_PRIVATE_KEY;

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
        const pubKey = args.pubKey || getPublicKey(VALIDATOR_PRIVATE_KEY!);

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
        goerli: {
            url: `https://goerli.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [`0x${GOERLI_PRIVATE_KEY || DEFAULT_PRIVATE_KEY}`],
            gasPrice: 10000000000,
            gas: 10000000
        },
        mainnet: {
            url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [`0x${MAINNET_PRIVATE_KEY || DEFAULT_PRIVATE_KEY}`]
        },
        mumbai: {
            url: "https://rpc-mumbai.maticvigil.com",
            gas: 10000000,
            gasPrice: 1500000000,
            accounts: [`0x${GOERLI_PRIVATE_KEY || DEFAULT_PRIVATE_KEY}`]
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
    }
    // contractSizer: {
    //     alphaSort: true,
    //     disambiguatePaths: false,
    //     runOnCompile: true,
    //     strict: true
    // }
};

export default config;
