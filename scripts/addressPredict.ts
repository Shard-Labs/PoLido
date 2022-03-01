import { ethers } from "hardhat";

export const predictContractAddress = (address: string, nonce: number) => {
    const rlpEncoded = ethers.utils.RLP.encode([
        address,
        ethers.BigNumber.from(nonce.toString()).toHexString()
    ]);
    const contractAddressLong = ethers.utils.keccak256(rlpEncoded);
    const contractAddress = "0x".concat(contractAddressLong.substring(26));

    return ethers.utils.getAddress(contractAddress);
};

console.log(predictContractAddress("0x59d07dc34B135B17b87840a86BFF7302039E7EDf", 12));