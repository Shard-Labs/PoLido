import { ethers } from "ethers";

export const GoerliOverrides = {
    gasLimit: ethers.utils.hexValue(10000000),
    gasPrice: ethers.utils.hexValue(10000000000)
};
