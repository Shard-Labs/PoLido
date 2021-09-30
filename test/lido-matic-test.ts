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
    MockNodeOperatorRegistry,
    MockNodeOperatorRegistry__factory,
} from '../typechain';
import { expect } from 'chai';
import { BigNumber } from '@ethersproject/bignumber';
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';

describe('LidoMatic', () => {
    let dao: SignerWithAddress;
    let deployer: SignerWithAddress;
    let lidoMatic: LidoMatic;
    let upgradedLido: LidoMaticUpgrade;
    let mockToken: IERC20;
    let mockValidatorShare: MockValidatorShare;
    let mockNodeOperatorRegistry: MockNodeOperatorRegistry;

    before(async () => {
        [deployer, dao] = await ethers.getSigners();

        const MockToken = (await ethers.getContractFactory(
            'MockToken'
        )) as MockToken__factory;

        const LidoMatic: LidoMatic__factory = (await ethers.getContractFactory(
            'LidoMatic'
        )) as LidoMatic__factory;

        const MockValidatorShare = (await ethers.getContractFactory(
            'MockValidatorShare'
        )) as MockValidatorShare__factory;

        const MockNodeOperatorRegistry = (await ethers.getContractFactory(
            'MockNodeOperatorRegistry'
        )) as MockNodeOperatorRegistry__factory;

        mockToken = await MockToken.deploy();
        await mockToken.deployed();

        mockValidatorShare = await MockValidatorShare.deploy(mockToken.address);
        await mockValidatorShare.deployed();

        mockNodeOperatorRegistry = await MockNodeOperatorRegistry.deploy(
            mockValidatorShare.address
        );
        await mockNodeOperatorRegistry.deployed();

        lidoMatic = (await upgrades.deployProxy(LidoMatic, [
            mockNodeOperatorRegistry.address,
            mockToken.address,
            dao.address,
        ])) as LidoMatic;
        await lidoMatic.deployed();
    });

    describe('Testing initialization and upgradeability...', () => {
        it('should successfully assign roles', async () => {
            const admin = ethers.utils.hexZeroPad('0x00', 32);
            const daoRole = keccak256(toUtf8Bytes('DAO'))
            const manageFee = keccak256(toUtf8Bytes('MANAGE_FEE'))
            const pauser = keccak256(toUtf8Bytes('PAUSE_ROLE'))
            const burner = keccak256(toUtf8Bytes('BURN_ROLE'))
            const treasury = keccak256(toUtf8Bytes('SET_TREASURY'))

            expect(await lidoMatic.hasRole(admin, deployer.address)).to.be.true;
            expect(await lidoMatic.hasRole(daoRole, dao.address)).to.be.true;
            expect(await lidoMatic.hasRole(manageFee, dao.address)).to.be.true;
            expect(await lidoMatic.hasRole(burner, dao.address)).to.be.true;
            expect(await lidoMatic.hasRole(treasury, dao.address)).to.be.true;
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
        it('should mint equal amount of tokens while no slashing or rewarding happened', async () => {
            const tokenAmount = ethers.utils.parseEther('0.1');

            const balanceOld = await upgradedLido.balanceOf(deployer.address);

            await mockToken.approve(upgradedLido.address, tokenAmount);

            await upgradedLido.submit(tokenAmount);

            const balanceNew = await upgradedLido.balanceOf(deployer.address);

            expect(balanceNew.sub(balanceOld).eq(tokenAmount)).to.be.true;
        });

        it('should mint greater amount of tokens after slashing has happened', async () => {
            const tokenAmount = ethers.utils.parseEther('0.1');

            const balanceOld = await upgradedLido.balanceOf(deployer.address);

            await upgradedLido.simulateSlashing();

            await mockToken.approve(upgradedLido.address, tokenAmount);

            await upgradedLido.submit(tokenAmount);

            const balanceNew = await upgradedLido.balanceOf(deployer.address);

            expect(balanceNew.sub(balanceOld).gt(tokenAmount)).to.be.true;
        });

        it('should mint lesser amount of tokens after the rewarding has happened', async () => {
            const tokenAmount = ethers.utils.parseEther('0.1');

            const balanceOld = await upgradedLido.balanceOf(deployer.address);

            await upgradedLido.simulateRewarding();

            await mockToken.approve(upgradedLido.address, tokenAmount);

            await upgradedLido.submit(tokenAmount);

            const balanceNew = await upgradedLido.balanceOf(deployer.address);

            expect(balanceNew.sub(balanceOld).lt(tokenAmount)).to.be.true;
        });

        it('should successfully delegate', async () => {
            const tokenAmount = ethers.utils.parseEther('0.1');

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
    });

    describe('Testing API...', () => {
        it('should sucessfully execute buyVoucher', async () => {
            // const tx = await (
            //     await lidoMatic.buyVoucher(mockValidatorShare.address, 100, 0)
            // ).wait();
            // expect(tx.status).to.equal(1);
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
