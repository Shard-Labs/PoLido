import { ethers } from "ethers";

export const TokenAddresses = {
    Testv4: "0x499d11e0b6eac7c0593d8fb292dcbbf815fb29ae",
};

export const GoerliOverrides = {
    gasLimit: ethers.utils.hexValue(10000000),
    gasPrice: ethers.utils.hexValue(10000000000)
};
