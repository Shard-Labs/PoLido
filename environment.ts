import * as dotenv from "dotenv";

dotenv.config();

const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const GOERLI_PRIVATE_KEY = process.env.GOERLI_PRIVATE_KEY || "";
const MAINNET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const VALIDATOR_PRIVATE_KEY = process.env.VALIDATOR_PRIVATE_KEY || "";
const POLYGON_RPC = process.env.POLYGON_RPC || "";
const MUMBAI_RPC = process.env.MUMBAI_RPC || "";
const MAINNET_RPC = process.env.MAINNET_RPC || "";
const GOERLI_RPC = process.env.GOERLI_RPC || "";
const MAINET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY || "";
const CHECKPOINT_MANAGER = process.env.CHECKPOINT_MANAGER || "";
const POLYGON_STAKE_MANAGER = process.env.POLYGON_STAKE_MANAGER || "";
const GOERLI_STAKE_MANAGER = process.env.GOERLI_STAKE_MANAGER || "";
const MAINNET_MATIC_TOKEN = process.env.MAINNET_MATIC_TOKEN || "";
const GOERLI_MATIC_TOKEN = process.env.GOERLI_MATIC_TOKEN || "";
const FX_ROOT = process.env.FX_ROOT || "";
const FX_CHILD = process.env.FX_CHILD || "";
const DAO = process.env.DAO || "";
const INSURANCE = process.env.INSURANCE || "";

export {
    INFURA_API_KEY,
    GOERLI_PRIVATE_KEY,
    MAINNET_PRIVATE_KEY,
    ETHERSCAN_API_KEY,
    VALIDATOR_PRIVATE_KEY,
    POLYGON_RPC,
    MUMBAI_RPC,
    MAINET_PRIVATE_KEY,
    CHECKPOINT_MANAGER,
    POLYGON_STAKE_MANAGER,
    GOERLI_STAKE_MANAGER,
    MAINNET_MATIC_TOKEN,
    GOERLI_MATIC_TOKEN,
    FX_ROOT,
    FX_CHILD,
    DAO,
    INSURANCE,
    MAINNET_RPC,
    GOERLI_RPC
};
