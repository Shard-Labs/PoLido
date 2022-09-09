import {
    PoLidoNFT
} from "../typechain";
import { describe } from "mocha";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

describe("PoLidoNFT Tests", () => {
    let poLidoNFT: PoLidoNFT;
    let accounts: SignerWithAddress[];
    let signer: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let user3: SignerWithAddress;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        signer = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];

        poLidoNFT = (await upgrades.deployProxy(
            await ethers.getContractFactory("PoLidoNFT"),
            ["PoLidoNFT", "LN", signer.address]
        )) as PoLidoNFT;
        await poLidoNFT.deployed();
    });

    describe("Mint tokens", () => {
        it("Should successfully mint tokens", async () => {
            await poLidoNFT.mint(user1.address);
            const tokenIndex = await poLidoNFT.tokenIdIndex();
            expect(tokenIndex).to.eq(1);
            expect(await poLidoNFT.owner2Tokens(user1.address, 0)).to.eq(1);
            expect(await poLidoNFT.getOwnedTokens(user1.address)).to.eql([tokenIndex]);
        });

        it("Should fail to mint tokens", async () => {
            await expect(poLidoNFT.connect(user1).mint(user2.address))
                .revertedWith("Caller is not stMATIC contract");
        });
    });

    describe("Approve tokens", () => {
        it("should successfully approve tokens", async () => {
            await poLidoNFT.mint(user2.address);
            const tokenIndex = await poLidoNFT.tokenIdIndex();
            await poLidoNFT.connect(user2).approve(user1.address, tokenIndex);
            expect(await poLidoNFT.address2Approved(user1.address, 0)).to.eq(1);
            expect(await poLidoNFT.tokenId2ApprovedIndex(tokenIndex)).to.eq(0);
            expect(await poLidoNFT.isApprovedOrOwner(user1.address, tokenIndex)).to.be.true;
        });

        it("should fail to approve tokens", async () => {
            await poLidoNFT.mint(user2.address);
            const tokenIndex = await poLidoNFT.tokenIdIndex();
            await expect(poLidoNFT.connect(user1).approve(user1.address, tokenIndex))
                .revertedWith("ERC721: approve caller is not token owner nor approved for all");
        });
    });

    describe("Burn tokens", () => {
        it("should successfully burn tokens", async () => {
            for (let i = 0; i < 3; i++) {
                await poLidoNFT.mint(user1.address);
                await poLidoNFT.connect(user1).approve(user2.address, i + 1);
            }
            const user1Tokens = await poLidoNFT.getOwnedTokens(user1.address);
            const tokenId = user1Tokens[1];
            const tokenIndex = await poLidoNFT.token2Index(tokenId);
            await poLidoNFT.burn(tokenId);

            expect((await poLidoNFT.getOwnedTokens(user1.address)).length).to.eq(2);
            expect(await poLidoNFT.token2Index(tokenId)).to.eq(0);
            expect(await poLidoNFT.tokenId2ApprovedIndex(tokenId)).to.eq(0);
            expect(await poLidoNFT.owner2Tokens(user1.address, tokenIndex)).to.eq(user1Tokens[2]);
            expect(await poLidoNFT.address2Approved(user2.address, tokenIndex)).to.eq(user1Tokens[2]);
        });

        it("should successfully burn tokens randomly", async () => {
            for (let i = 0; i < 5; i++) {
                await poLidoNFT.mint(user1.address);
            }

            expect((await poLidoNFT.getOwnedTokens(user1.address)).length).eq(5);
            await poLidoNFT.burn(2);
            await poLidoNFT.burn(1);
            await poLidoNFT.burn(3);
            await poLidoNFT.burn(5);
            await poLidoNFT.burn(4);
            expect((await poLidoNFT.getOwnedTokens(user1.address)).length).eq(0);
        });

        it("should successfully burn approved tokens randomly", async () => {
            for (let i = 0; i < 5; i++) {
                await poLidoNFT.mint(user1.address);
                await poLidoNFT.connect(user1).approve(user2.address, i + 1);
            }

            expect((await poLidoNFT.getApprovedTokens(user2.address)).length).eq(5);
            await poLidoNFT.connect(user1).approve(user3.address, 2);
            await poLidoNFT.connect(user1).approve(user3.address, 1);
            await poLidoNFT.connect(user1).approve(user3.address, 3);
            await poLidoNFT.connect(user1).approve(user3.address, 5);
            await poLidoNFT.connect(user1).approve(user3.address, 4);
            expect((await poLidoNFT.getApprovedTokens(user2.address)).length).eq(0);
            expect((await poLidoNFT.getApprovedTokens(user3.address)).length).eq(5);
        });

        it("should fail to burn tokens", async () => {
            await poLidoNFT.mint(user1.address);
            const tokenIndex = await poLidoNFT.tokenIdIndex();

            await expect(poLidoNFT.connect(user1).burn(tokenIndex))
                .revertedWith("Caller is not stMATIC contract");
        });
    });

    describe("Setters", () => {
        it("should successfully set setStMATIC address", async () => {
            await poLidoNFT.setStMATIC(user2.address);
            expect(await poLidoNFT.stMATIC()).to.eq(user2.address);
        });

        it("should fail to set setStMATIC address", async () => {
            await expect(poLidoNFT.connect(user2).setStMATIC(user2.address))
                .revertedWith("Ownable: caller is not the owner");
        });

        it("should successfully set version", async () => {
            await poLidoNFT.setVersion(user1.address);
            expect(await poLidoNFT.version()).to.eq(user1.address);
        });

        it("should fail to set version", async () => {
            await expect(poLidoNFT.connect(user1).setVersion(user1.address))
                .revertedWith("Ownable: caller is not the owner");
        });
    });
});
