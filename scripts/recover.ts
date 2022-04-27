import hre, { ethers } from "hardhat";
import { NodeOperatorRegistry, StMATIC } from "../typechain";

const main = async () => {
    const accountAddress = "0x3E46BEFDA7112d8954b923ea6bd9f07c2e615e10";
    const owner = await ethers.getSigner(accountAddress);
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [accountAddress]
    });

    await hre.network.provider.send("hardhat_setBalance", [
        owner.address,
        "0x1000D3C21BCECCEDA1000000"
    ]);

    await hre.network.provider.send("hardhat_setStorageAt", [
        "0x13b954d5FC225eF64650A7D723de763F03e1dbD2",
        "0x0",
        "0x0000000000000000000000003E46BEFDA7112d8954b923ea6bd9f07c2e615e10"
    ]);
    const f = await ethers.getContractFactory("NodeOperatorRegistry");
    const fs = await ethers.getContractFactory("StMATIC");
    const impl = await (await f.deploy()).deployed();
    const impls = await (await fs.deploy()).deployed();
    const admin = await ethers.getContractAt(adminABI, "0x13b954d5FC225eF64650A7D723de763F03e1dbD2");
    await admin.connect(owner).upgrade("0xb1f3f45360Cf0A30793e38C18dfefCD0d5136f9a", impl.address);
    await admin.connect(owner).upgrade("0x9A7c69A167160C507602ecB3Df4911e8E98e1279", impls.address);
    const c = (await ethers.getContractAt("NodeOperatorRegistry", "0xb1f3f45360Cf0A30793e38C18dfefCD0d5136f9a"))as NodeOperatorRegistry;
    const cc = (await ethers.getContractAt("StMATIC", "0x9A7c69A167160C507602ecB3Df4911e8E98e1279"))as StMATIC;
    await c.connect(owner).recover();
    console.log(await c["getNodeOperator(uint256)"].call(this, 1));
    console.log(await c.getOperatorIds());
    console.log(await c["getNodeOperator(uint256)"].call(this, 5));
    console.log(await c.getOperatorIds());
    console.log(await c.getOperatorInfos(true, false));
    console.log(await c.getOperatorInfos(true, true));
    console.log(await c.nodeOperatorCounter());
    console.log(await c["getNodeOperator(address)"].call(this, "0x5A1B57f87B59E093D332C945C66b602843099F97"));
    console.log(await c["getNodeOperator(address)"].call(this, "0xE77A6319FDC1456e5DEF674FBC7d77e72B9EFcC9"));
    await cc.connect(owner).requestWithdraw(ethers.utils.parseEther("2"));
};

const adminABI = [{ anonymous: false, inputs: [{ indexed: true, internalType: "address", name: "previousOwner", type: "address" }, { indexed: true, internalType: "address", name: "newOwner", type: "address" }], name: "OwnershipTransferred", type: "event" }, { inputs: [{ internalType: "contract TransparentUpgradeableProxy", name: "proxy", type: "address" }, { internalType: "address", name: "newAdmin", type: "address" }], name: "changeProxyAdmin", outputs: [], stateMutability: "nonpayable", type: "function" }, { inputs: [{ internalType: "contract TransparentUpgradeableProxy", name: "proxy", type: "address" }], name: "getProxyAdmin", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" }, { inputs: [{ internalType: "contract TransparentUpgradeableProxy", name: "proxy", type: "address" }], name: "getProxyImplementation", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" }, { inputs: [], name: "owner", outputs: [{ internalType: "address", name: "", type: "address" }], stateMutability: "view", type: "function" }, { inputs: [], name: "renounceOwnership", outputs: [], stateMutability: "nonpayable", type: "function" }, { inputs: [{ internalType: "address", name: "newOwner", type: "address" }], name: "transferOwnership", outputs: [], stateMutability: "nonpayable", type: "function" }, { inputs: [{ internalType: "contract TransparentUpgradeableProxy", name: "proxy", type: "address" }, { internalType: "address", name: "implementation", type: "address" }], name: "upgrade", outputs: [], stateMutability: "nonpayable", type: "function" }, { inputs: [{ internalType: "contract TransparentUpgradeableProxy", name: "proxy", type: "address" }, { internalType: "address", name: "implementation", type: "address" }, { internalType: "bytes", name: "data", type: "bytes" }], name: "upgradeAndCall", outputs: [], stateMutability: "payable", type: "function" }];
main();
