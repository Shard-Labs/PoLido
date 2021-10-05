import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
    LidoMatic__factory,
    LidoMatic,
    IERC20,
    MockToken__factory,
    MockValidatorShare__factory,
    MockValidatorShare,
    LidoMaticUpgrade,
    MockNodeOperatorRegistry,
    MockNodeOperatorRegistry__factory,
    MockInsurance__factory,
    MockInsurance,
    MockOperator__factory,
    MockOperator
} from "../typechain";
import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";

describe("LidoMatic", () => {
    let dao: SignerWithAddress;
    let deployer: SignerWithAddress;
    let lidoMatic: LidoMatic;
    let upgradedLido: LidoMaticUpgrade;
    let mockToken: IERC20;
    let mockValidatorShare: MockValidatorShare;
    let mockNodeOperatorRegistry: MockNodeOperatorRegistry;
    let mockInsurance: MockInsurance;
    let mockOperator: MockOperator;

    before(async () => {
        [deployer, dao] = await ethers.getSigners();

        const MockToken = (await ethers.getContractFactory(
            "MockToken"
        )) as MockToken__factory;

        const LidoMatic: LidoMatic__factory = (await ethers.getContractFactory(
            "LidoMatic"
        )) as LidoMatic__factory;

        const MockValidatorShare = (await ethers.getContractFactory(
            "MockValidatorShare"
        )) as MockValidatorShare__factory;

        const MockNodeOperatorRegistry = (await ethers.getContractFactory(
            "MockNodeOperatorRegistry"
        )) as MockNodeOperatorRegistry__factory;

        const MockInsurance = (await ethers.getContractFactory(
            "MockInsurance"
        )) as MockInsurance__factory;

        const MockOperator = (await ethers.getContractFactory(
            "MockOperator"
        )) as MockOperator__factory;

        mockOperator = await MockOperator.deploy();
        await mockOperator.deployed();

        mockInsurance = await MockInsurance.deploy();
        await mockInsurance.deployed();

        mockToken = await MockToken.deploy();
        await mockToken.deployed();

        mockValidatorShare = await MockValidatorShare.deploy(mockToken.address);
        await mockValidatorShare.deployed();

        mockNodeOperatorRegistry = await MockNodeOperatorRegistry.deploy(
            mockValidatorShare.address,
            mockOperator.address
        );
        await mockNodeOperatorRegistry.deployed();

        lidoMatic = (await upgrades.deployProxy(LidoMatic, [
            mockNodeOperatorRegistry.address,
            mockToken.address,
            dao.address,
            mockInsurance.address
        ])) as LidoMatic;
        await lidoMatic.deployed();
    });

    describe("Testing initialization and upgradeability...", () => {
        it("should successfully assign roles", async () => {
            const admin = ethers.utils.hexZeroPad("0x00", 32);
            const daoRole = keccak256(toUtf8Bytes("DAO"));
            const manageFee = keccak256(toUtf8Bytes("MANAGE_FEE"));
            const pauser = keccak256(toUtf8Bytes("PAUSE_ROLE"));
            const burner = keccak256(toUtf8Bytes("BURN_ROLE"));
            const treasury = keccak256(toUtf8Bytes("SET_TREASURY"));

            expect(await lidoMatic.hasRole(admin, deployer.address)).to.be.true;
            expect(await lidoMatic.hasRole(daoRole, dao.address)).to.be.true;
            expect(await lidoMatic.hasRole(manageFee, dao.address)).to.be.true;
            expect(await lidoMatic.hasRole(burner, dao.address)).to.be.true;
            expect(await lidoMatic.hasRole(treasury, dao.address)).to.be.true;
            expect(await lidoMatic.hasRole(pauser, deployer.address)).to.be
                .true;
        });
        it("should upgrade lido matic contract successfully", async () => {
            const LidoMaticUpgrade = await ethers.getContractFactory(
                "LidoMaticUpgrade"
            );

            upgradedLido = (await upgrades.upgradeProxy(
                lidoMatic.address,
                LidoMaticUpgrade
            )) as LidoMaticUpgrade;

            expect(await upgradedLido.upgraded()).to.be.true;
            expect(upgradedLido.address).to.equal(lidoMatic.address);
        });
    });

    describe("Testing main functionalities...", async () => {
        it("should mint equal amount of tokens while no slashing or rewarding happened", async () => {
            const tokenAmount = ethers.utils.parseEther("0.1");

            const balanceOld = await upgradedLido.balanceOf(deployer.address);

            await mockToken.approve(upgradedLido.address, tokenAmount);

            await upgradedLido.submit(tokenAmount);

            const balanceNew = await upgradedLido.balanceOf(deployer.address);

            expect(balanceNew.sub(balanceOld).eq(tokenAmount)).to.be.true;
        });

        it("should mint greater amount of tokens after slashing has happened", async () => {
            const tokenAmount = ethers.utils.parseEther("0.1");

            const balanceOld = await upgradedLido.balanceOf(deployer.address);

            await upgradedLido.simulateSlashing();

            await mockToken.approve(upgradedLido.address, tokenAmount);

            await upgradedLido.submit(tokenAmount);

            const balanceNew = await upgradedLido.balanceOf(deployer.address);

            expect(balanceNew.sub(balanceOld).gt(tokenAmount)).to.be.true;
        });

        it("should mint lesser amount of tokens after the rewarding has happened", async () => {
            const tokenAmount = ethers.utils.parseEther("0.1");

            const balanceOld = await upgradedLido.balanceOf(deployer.address);

            await upgradedLido.simulateRewarding();

            await mockToken.approve(upgradedLido.address, tokenAmount);

            await upgradedLido.submit(tokenAmount);

            const balanceNew = await upgradedLido.balanceOf(deployer.address);

            expect(balanceNew.sub(balanceOld).lt(tokenAmount)).to.be.true;
        });

        it("should successfully delegate", async () => {
            const tokenAmount = ethers.utils.parseEther("0.1");

            await mockToken.approve(upgradedLido.address, tokenAmount);

            await upgradedLido.submit(tokenAmount);

            const upgradedLidoAsDao = new ethers.Contract(
                upgradedLido.address,
                upgradedLido.interface,
                dao
            ) as LidoMaticUpgrade;

            await upgradedLidoAsDao.delegate();

            const validatorShareBalance = await mockToken.balanceOf(
                mockValidatorShare.address
            );

            expect(validatorShareBalance.gt(0)).to.be.true;
        });

        it("should successfully request withdraw", async () => {
            const senderBalance = await upgradedLido.balanceOf(
                deployer.address
            );

            // If we withdraw all tokens and totalAmount() is equal to users balance
            // we get an error "reverted with panic code 0x12 (Division or modulo division by zero)"
            await upgradedLido.requestWithdraw(senderBalance.div(2));

            const withdrawRequest = await upgradedLido.user2WithdrawRequest(
                deployer.address,
                0
            );

            expect(withdrawRequest.validatorNonce.eq(1)).to.be.true;
        });

        it("shouldn't allow claiming tokens before required time has passed", async () => {
            await expect(upgradedLido.claimTokens()).to.be.revertedWith(
                "Not able to claim yet"
            );
        });

        it("should successfully claim tokens", async () => {
            const userBalanceBefore = await mockToken.balanceOf(
                deployer.address
            );

            await ethers.provider.send("evm_mine", [1625097606000]);

            await upgradedLido.claimTokens();

            const userBalanceAfter = await mockToken.balanceOf(
                deployer.address
            );

            expect(userBalanceBefore.lt(userBalanceAfter)).to.be.true;
        });

        it("should successfully distribute rewards", async () => {
            const operatorBalanceBefore = await mockToken.balanceOf(
                mockOperator.address
            );
            const insuranceBalanceBefore = await mockToken.balanceOf(
                mockInsurance.address
            );
            const daoBalanceBefore = await mockToken.balanceOf(dao.address);

            await upgradedLido.distributeRewards();

            const operatorBalanceAfter = await mockToken.balanceOf(
                mockOperator.address
            );
            const insuranceBalanceAfter = await mockToken.balanceOf(
                mockInsurance.address
            );
            const daoBalanceAfter = await mockToken.balanceOf(dao.address);

            expect(operatorBalanceAfter.gt(operatorBalanceBefore)).to.be.true;
            expect(insuranceBalanceAfter.gt(insuranceBalanceBefore)).to.be.true;
            expect(daoBalanceAfter.gt(daoBalanceBefore)).to.be.true;
        });
    });

    describe("Testing API...", () => {
        // it('should sucessfully execute restake', async () => {
        //     const tx = await (
        //         await lidoMatic.restake(mockValidatorShare.address)
        //     ).wait();

        //     expect(tx.status).to.equal(1);
        // });

        // it('should sucessfully execute unstakeClaimTokens_new', async () => {
        //     const tx = await (
        //         await lidoMatic.unstakeClaimTokens_new(
        //             mockValidatorShare.address,
        //             0
        //         )
        //     ).wait();

        //     expect(tx.status).to.equal(1);
        // });

        // it('should sucessfully execute sellVoucher_new', async () => {
        //     const tx = await (
        //         await lidoMatic.sellVoucher_new(
        //             mockValidatorShare.address,
        //             100,
        //             0
        //         )
        //     ).wait();

        //     expect(tx.status).to.equal(1);
        // });

        it("should sucessfully execute getTotalStake", async () => {
            const totalStake = await lidoMatic.getTotalStake(
                mockValidatorShare.address
            );

            expect(totalStake).to.eql([BigNumber.from(1), BigNumber.from(1)]);
        });
    });
});
