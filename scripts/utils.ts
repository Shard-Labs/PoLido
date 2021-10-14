import { ethers } from "ethers";
import { publicKeyCreate } from "secp256k1";

export const getPublicKey = (privateKey: string): Uint8Array => {
    const privKeyBytes = ethers.utils.arrayify(privateKey);
    const pubKeyBytes = publicKeyCreate(privKeyBytes, false).slice(1);

    return pubKeyBytes;
};
