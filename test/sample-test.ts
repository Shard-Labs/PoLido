import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("Token", function () {
    let accounts: Signer[];

    beforeEach(async function () {
        accounts = await ethers.getSigners();
    });

    it("should do something right", async function () {
        console.log(accounts);
    // Do something with the accounts
    });
});
