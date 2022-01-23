import * as dotenv from "dotenv";
import * as path from "path";

const envSuffix = process.env.NODE_ENV === "main" ? "" : ".test";

dotenv.config({ path: path.join(__dirname + "/.env" + envSuffix) });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const VALIDATOR_PRIVATE_KEY = process.env.VALIDATOR_PRIVATE_KEY || "";
const CHILD_CHAIN_RPC = process.env.CHILD_CHAIN_RPC || "";
const ROOT_CHAIN_RPC = process.env.ROOT_CHAIN_RPC || "";
const CHECKPOINT_MANAGER = process.env.CHECKPOINT_MANAGER || "";
const STAKE_MANAGER = process.env.STAKE_MANAGER || "";
const MATIC_TOKEN = process.env.MATIC_TOKEN || "";
const FX_ROOT = process.env.FX_ROOT || "";
const FX_CHILD = process.env.FX_CHILD || "";
const DAO = process.env.DAO || "";
const INSURANCE = process.env.INSURANCE || "";
const CHILD_GAS_PRICE = process.env.CHILD_GAS_PRICE || "";
const CHILD_GAS_LIMIT = process.env.CHILD_GAS_LIMIT || "";
const ROOT_GAS_PRICE = process.env.ROOT_GAS_PRICE || "";
const ROOT_GAS_LIMIT = process.env.ROOT_GAS_LIMIT || "";

export {
    DEPLOYER_PRIVATE_KEY,
    ETHERSCAN_API_KEY,
    VALIDATOR_PRIVATE_KEY,
    CHILD_CHAIN_RPC,
    ROOT_CHAIN_RPC,
    CHECKPOINT_MANAGER,
    STAKE_MANAGER,
    MATIC_TOKEN,
    FX_ROOT,
    FX_CHILD,
    DAO,
    INSURANCE,
    CHILD_GAS_PRICE,
    CHILD_GAS_LIMIT,
    ROOT_GAS_PRICE,
    ROOT_GAS_LIMIT
};
