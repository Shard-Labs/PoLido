import hardhat, { ethers, upgrades } from "hardhat";
import { getUpgradeContext } from "./utils";

const abi = [
    {
        type: "function",
        name: "getChainId",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { type: "uint256", name: "chainId" }
        ]
    },
    {
        type: "function",
        name: "getOwners",
        stateMutability: "view",
        inputs: [],
        outputs: [
            {
                internalType: "address[]",
                name: "owners",
                type: "address[]"
            }
        ]
    }
];

const transferOwnership = async () => {
    console.log("Transferring ownership of ProxyAdmin...");
    const { deployDetails } = getUpgradeContext(hardhat);

    await checkMultisig(deployDetails.multisig_upgrader.address, deployDetails.multisig_upgrader.owners);
    try {
        await upgrades.admin.transferProxyAdminOwnership(deployDetails.multisig_upgrader.address);
    } catch (e) {
        console.log(e);
    }

    console.log("Transferred ownership of ProxyAdmin to:", deployDetails.multisig_upgrader.address);
};

async function checkMultisig (multisig: string, multisigOwners: Array<string>) {
    const multisigContract = await ethers.getContractAt(abi, multisig);

    if ((await ethers.provider.getCode(multisig)) === "0x") {
        throw new Error("Multisig address is not a contract");
    }

    const network = await ethers.provider.getNetwork();
    const multisigNetwork = await multisigContract.getChainId();

    console.log("Provider Network ID:", network.chainId);
    console.log("Multisig Network ID:", Number(multisigNetwork));

    if (Number(multisigNetwork) !== network.chainId) {
        throw new Error("Invalid Network");
    }

    const owners = await multisigContract.getOwners();
    if (owners.length === 0) {
        throw new Error("Empty owner list");
    }

    for (let i = 0; i < owners.length; i++) {
        let found = false;
        for (let j = 0; j < multisigOwners.length; j++) {
            if (owners[i] === multisigOwners[j]) {
                found = true;
                break;
            }
        }
        if (!found) {
            throw new Error(`Owner address: '${owners[i]}' not found`);
        }
    }
}
transferOwnership();
