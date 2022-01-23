import {
    CHILD_GAS_LIMIT,
    CHILD_GAS_PRICE,
    ROOT_GAS_LIMIT,
    ROOT_GAS_PRICE
} from "./environment";

const CHILD_GAS_DETAILS = {
    gasPrice: CHILD_GAS_PRICE,
    gasLimit: CHILD_GAS_LIMIT
};

const ROOT_GAS_DETAILS = {
    gasPrice: ROOT_GAS_PRICE,
    gasLimit: ROOT_GAS_LIMIT
};

export { CHILD_GAS_DETAILS, ROOT_GAS_DETAILS };
