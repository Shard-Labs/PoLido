import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { LidoNFT__factory, LidoNFT } from "../typechain";
import { expect } from "chai";
import { BigNumber } from "ethers";

describe("LidoNFT", () => {
    let lido: SignerWithAddress;
    let accounts: SignerWithAddress[];
    let lidoNFT: LidoNFT;

    before(async () => {
        [lido, ...accounts] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const LidoNft = (await ethers.getContractFactory(
            "LidoNFT",
            lido
        )) as LidoNFT__factory;

        lidoNFT = (await upgrades.deployProxy(LidoNft, [
            "stMATIC_NFT",
            "STM_NFT"
        ])) as LidoNFT;
        await lidoNFT.deployed();

        await lidoNFT.setLido(lido.address);

        // Mint some tokens

        await lidoNFT.mint(lido.address);
        await lidoNFT.mint(accounts[0].address);
        await lidoNFT.mint(accounts[0].address);
        await lidoNFT.mint(accounts[1].address);
        await lidoNFT.mint(accounts[1].address);
        await lidoNFT.mint(accounts[1].address);
        await lidoNFT.mint(accounts[2].address);
        await lidoNFT.mint(accounts[2].address);
        await lidoNFT.mint(accounts[2].address);
        await lidoNFT.mint(accounts[2].address);
    });

    describe("Testing main functionalities...", async () => {
        it("Should successfully mint 1 token to lido, 2 tokens to account0, 3 tokens to account1 and 4 tokens to account3", async () => {
            const deployerBalance = await lidoNFT.balanceOf(lido.address);
            const account0Balance = await lidoNFT.balanceOf(accounts[0].address);
            const account1Balance = await lidoNFT.balanceOf(accounts[1].address);
            const account2Balance = await lidoNFT.balanceOf(accounts[2].address);

            const totalSupply = await lidoNFT.tokenIdIndex();

            expect(totalSupply.toNumber()).to.equal(10);
            expect(deployerBalance.toNumber()).to.equal(1);
            expect(account0Balance.toNumber()).to.equal(2);
            expect(account1Balance.toNumber()).to.equal(3);
            expect(account2Balance.toNumber()).to.equal(4);
        });
        it("Should successfully retrieve owned tokens of address", async () => {
            const deployerTokens = await lidoNFT.getOwnedTokens(lido.address);
            const account0Tokens = await lidoNFT.getOwnedTokens(accounts[0].address);
            const account1Tokens = await lidoNFT.getOwnedTokens(accounts[1].address);
            const account2Tokens = await lidoNFT.getOwnedTokens(accounts[2].address);

            const deployerExpected = [BigNumber.from(1)];
            const account0Expected = [BigNumber.from(2), BigNumber.from(3)];
            const account1Expected = [BigNumber.from(4), BigNumber.from(5), BigNumber.from(6)];
            const account2Expected = [BigNumber.from(7), BigNumber.from(8), BigNumber.from(9), BigNumber.from(10)];

            expect(deployerTokens).to.eql(deployerExpected);
            expect(account0Tokens).to.eql(account0Expected);
            expect(account1Tokens).to.eql(account1Expected);
            expect(account2Tokens).to.eql(account2Expected);
        });
        it("Should successfully transfer token 2 from account0 to lido and update owned tokens", async () => {
            lidoNFT = lidoNFT.connect(accounts[0]);
            await lidoNFT.approve(lido.address, 2);

            // Check if a token is in approval list
            const deployerApprovedPre = await lidoNFT.getApprovedTokens(lido.address);
            const approvedExpectedPre = [BigNumber.from(2)];
            expect(deployerApprovedPre).to.eql(approvedExpectedPre);

            lidoNFT = lidoNFT.connect(lido);
            await lidoNFT.transferFrom(accounts[0].address, lido.address, 2);

            const deployerExpected = [BigNumber.from(1), BigNumber.from(2)];
            const deployerTokens = await lidoNFT.getOwnedTokens(lido.address);

            const account0Expected = [BigNumber.from(3)];
            // Remove all 0 entries
            const account0Tokens = (await lidoNFT.getOwnedTokens(accounts[0].address)).filter(tokenId => tokenId.toNumber() !== 0);

            expect(deployerTokens).to.eql(deployerExpected);
            expect(account0Expected).to.eql(account0Tokens);

            // Check if approval was reset
            const deployerApprovedPost = (await lidoNFT.getApprovedTokens(lido.address)).filter(tokenId => tokenId.toNumber() !== 0);
            expect(deployerApprovedPost.length).to.equal(0);
        });

        it("Should add tokens to approval list", async () => {
            const lidoNft1 = lidoNFT.connect(accounts[0]);
            await lidoNft1.approve(lido.address, 2);
            await lidoNft1.approve(lido.address, 3);

            const lidoNft2 = lidoNFT.connect(accounts[1]);
            await lidoNft2.approve(lido.address, 4);
            await lidoNft2.approve(lido.address, 5);
            await lidoNft2.approve(lido.address, 6);

            const approvedTokensLido = (await lidoNft1.getApprovedTokens(lido.address)).map(tokenId => tokenId.toNumber());
            const expected = [2, 3, 4, 5, 6];

            expect(approvedTokensLido).to.eql(expected);
        });

        it("Should remove token from approved and owned arrays after burning", async () => {
            const lidoNft1 = lidoNFT.connect(accounts[0]);
            await lidoNft1.approve(lido.address, 2);
            await lidoNft1.approve(lido.address, 3);

            const lidoNft2 = lidoNFT.connect(accounts[1]);
            await lidoNft2.approve(lido.address, 4);
            await lidoNft2.approve(lido.address, 5);
            await lidoNft2.approve(lido.address, 6);

            await lidoNFT.burn(3);

            const ownedTokens = (await lidoNFT.getOwnedTokens(accounts[0].address)).map(tokenId => tokenId.toNumber());
            const approvedTokens = (await lidoNFT.getApprovedTokens(lido.address)).map(tokenId => tokenId.toNumber());

            const ownedExpected = [2, 0];
            const approvedExpected = [2, 0, 4, 5, 6];

            expect(ownedExpected).to.eql(ownedTokens);
            expect(approvedExpected).to.eql(approvedTokens);
        });

        it("Should remove token from approved and owned arrays after burning", async () => {
            const lidoNft1 = lidoNFT.connect(accounts[0]);
            await lidoNft1.approve(lido.address, 2);
            await lidoNft1.approve(lido.address, 3);

            const lidoNft2 = lidoNFT.connect(accounts[1]);
            await lidoNft2.approve(lido.address, 4);
            await lidoNft2.approve(lido.address, 5);
            await lidoNft2.approve(lido.address, 6);

            await lidoNFT.burn(2);
            await lidoNFT.burn(3);
            await lidoNFT.burn(6);

            const ownedTokens = (await lidoNFT.getOwnedTokens(accounts[0].address)).map(tokenId => tokenId.toNumber());
            const approvedTokens = (await lidoNFT.getApprovedTokens(lido.address)).map(tokenId => tokenId.toNumber());

            const ownedExpected = [0, 0];
            const approvedExpected = [0, 0, 4, 5, 0];

            expect(ownedExpected).to.eql(ownedTokens);
            expect(approvedExpected).to.eql(approvedTokens);
        });

        it("Should remove token from the old approve array after the new approval", async () => {
            const lidoNft1 = lidoNFT.connect(accounts[0]);
            await lidoNft1.approve(lido.address, 2);
            await lidoNft1.approve(lido.address, 3);

            await lidoNft1.approve(accounts[5].address, 2);

            const approvedLidoExpected = [0, 3];
            const approvedAcc5Expected = [2];

            const approvedLido = (await lidoNFT.getApprovedTokens(lido.address)).map(tokenId => tokenId.toNumber());
            const approvedAcc5 = (await lidoNFT.getApprovedTokens(accounts[5].address)).map(tokenId => tokenId.toNumber());

            expect(approvedLido).to.eql(approvedLidoExpected);
            expect(approvedAcc5).to.eql(approvedAcc5Expected);
        });

        // Test approving and the calling transfer function
    });
});
