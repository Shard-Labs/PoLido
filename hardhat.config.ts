import * as dotenv from "dotenv";
import * as path from "path";
import { HardhatUserConfig, task } from "hardhat/config";

import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-gas-reporter";

import { verify, addOperator } from "./scripts/tasks";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { OperatorArgs } from "./scripts/types";

dotenv.config({ path: path.join(__dirname, ".env") });

const INFURA_API_KEY = process.env.INFURA_API_KEY;
const GOERLI_PRIVATE_KEY = process.env.GOERLI_PRIVATE_KEY;
const MAINNET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

task("verifyLido", "Lido contracts verification").setAction(
    async (args, hre: HardhatRuntimeEnvironment) => {
        await verify(hre);
    }
);

task("addOperator", "Assigns operator")
    .addOptionalParam("operatorName", "Name of the new operator")
    .addOptionalParam("rewardAddress", "Reward address of the new operator")
    .addOptionalParam("address", "Address of the new operator")
    .setAction(async (args: OperatorArgs, hre: HardhatRuntimeEnvironment) => {
        const { operatorName, rewardAddress, pubKey } = args;

        await addOperator(hre, operatorName, rewardAddress, pubKey);
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
            accounts: [`0x${GOERLI_PRIVATE_KEY}`],
            gasPrice: 10000000000
        },
        mainnet: {
            url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [`0x${MAINNET_PRIVATE_KEY}`]
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
};

export default config;
