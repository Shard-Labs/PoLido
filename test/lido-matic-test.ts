import { ethers, upgrades } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
    LidoMatic__factory,
    LidoMatic,
    IERC20,
    MockToken__factory,
    MockValidatorShare__factory,
    MockValidatorShare,
    LidoMaticUpgrade,
} from '../typechain';
import { expect } from 'chai';
import { BigNumber } from '@ethersproject/bignumber';

describe('LidoMatic', () => {
    let deployer: SignerWithAddress;
    let lidoMatic: LidoMatic;
    let upgradedLido: LidoMaticUpgrade;
    let mockToken: IERC20;
    let mockValidatorShare: MockValidatorShare;

    const DAO = ethers.constants.AddressZero;
    const NODE_OPERATOR = ethers.constants.AddressZero;

    before(async () => {
        [deployer] = await ethers.getSigners();

        const MockToken = (await ethers.getContractFactory(
            'MockToken'
        )) as MockToken__factory;

        const LidoMatic: LidoMatic__factory = (await ethers.getContractFactory(
            'LidoMatic'
        )) as LidoMatic__factory;

        const MockValidatorShare = (await ethers.getContractFactory(
            'MockValidatorShare'
        )) as MockValidatorShare__factory;

        mockToken = await MockToken.deploy();
        await mockToken.deployed();

        lidoMatic = (await upgrades.deployProxy(LidoMatic, [
            NODE_OPERATOR,
            mockToken.address,
            DAO,
        ])) as LidoMatic;
        await lidoMatic.deployed();

        mockValidatorShare = await MockValidatorShare.deploy();
        await mockValidatorShare.deployed();
    });

    describe('Testing initialization and upgradeability...', () => {
        it('should successfully assign roles', async () => {
            const admin = ethers.utils.hexZeroPad('0x00', 32);
            const dao = ethers.utils.formatBytes32String('DAO');
            const manageFee = ethers.utils.formatBytes32String('MANAGE_FEE');
            const pauser = ethers.utils.formatBytes32String('PAUSE_ROLE');
            const burner = ethers.utils.formatBytes32String('BURN_ROLE');
            const treasury = ethers.utils.formatBytes32String('SET_TREASURY');

            expect(await lidoMatic.hasRole(admin, deployer.address)).to.be.true;
            expect(await lidoMatic.hasRole(dao, DAO)).to.be.true;
            expect(await lidoMatic.hasRole(manageFee, DAO)).to.be.true;
            expect(await lidoMatic.hasRole(burner, DAO)).to.be.true;
            expect(await lidoMatic.hasRole(treasury, DAO)).to.be.true;
            expect(await lidoMatic.hasRole(pauser, deployer.address)).to.be
                .true;
        });
        it('should upgrade lido matic contract successfully', async () => {
            const LidoMaticUpgrade = await ethers.getContractFactory(
                'LidoMaticUpgrade'
            );

            upgradedLido = (await upgrades.upgradeProxy(
                lidoMatic.address,
                LidoMaticUpgrade
            )) as LidoMaticUpgrade;

            expect(await upgradedLido.upgraded()).to.be.true;
            expect(upgradedLido.address).to.equal(lidoMatic.address);
        });
    });

    describe('Testing main functionalities...', async () => {
        it('it should mint equal amount of tokens while no slashing or rewarding happened', async () => {
            const tokenAmount = ethers.utils.parseEther('0.1');

            const balanceOld = await upgradedLido.balanceOf(deployer.address);

            await mockToken.approve(upgradedLido.address, tokenAmount);

            await upgradedLido.submit(tokenAmount);

            const balanceNew = await upgradedLido.balanceOf(deployer.address);

            expect(balanceNew.sub(balanceOld).eq(tokenAmount)).to.be.true;
        });

        it('it should mint greater amount of tokens after slashing has happened', async () => {
            const tokenAmount = ethers.utils.parseEther('0.1');

            const balanceOld = await upgradedLido.balanceOf(deployer.address);

            await upgradedLido.simulateSlashing();

            await mockToken.approve(upgradedLido.address, tokenAmount);

            await upgradedLido.submit(tokenAmount);

            const balanceNew = await upgradedLido.balanceOf(deployer.address);

            expect(balanceNew.sub(balanceOld).gt(tokenAmount)).to.be.true;
        });

        it('it should mint lesser amount of tokens after the rewarding has happened', async () => {
            const tokenAmount = ethers.utils.parseEther('0.1');

            const balanceOld = await upgradedLido.balanceOf(deployer.address);

            await upgradedLido.simulateRewarding();

            await mockToken.approve(upgradedLido.address, tokenAmount);

            await upgradedLido.submit(tokenAmount);

            const balanceNew = await upgradedLido.balanceOf(deployer.address);

            expect(balanceNew.sub(balanceOld).lt(tokenAmount)).to.be.true;
        });
    });

    describe('Testing API...', () => {
        it('should sucessfully execute buyVoucher', async () => {
            const tx = await (
                await lidoMatic.buyVoucher(mockValidatorShare.address, 100, 0)
            ).wait();

            expect(tx.status).to.equal(1);
        });

        it('should sucessfully execute restake', async () => {
            const tx = await (
                await lidoMatic.restake(mockValidatorShare.address)
            ).wait();

            expect(tx.status).to.equal(1);
        });

        it('should sucessfully execute unstakeClaimTokens_new', async () => {
            const tx = await (
                await lidoMatic.unstakeClaimTokens_new(
                    mockValidatorShare.address,
                    0
                )
            ).wait();

            expect(tx.status).to.equal(1);
        });

        it('should sucessfully execute sellVoucher_new', async () => {
            const tx = await (
                await lidoMatic.sellVoucher_new(
                    mockValidatorShare.address,
                    100,
                    0
                )
            ).wait();

            expect(tx.status).to.equal(1);
        });

        it('should sucessfully execute getTotalStake', async () => {
            const totalStake = await lidoMatic.getTotalStake(
                mockValidatorShare.address
            );

            expect(totalStake).to.eql([BigNumber.from(1), BigNumber.from(1)]);
        });

        it('should sucessfully execute getLiquidRewards', async () => {
            const liquidRewards = await lidoMatic.getLiquidRewards(
                mockValidatorShare.address
            );

            expect(liquidRewards).to.equal(1);
        });
    });
});
