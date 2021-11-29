import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import {
    LidoMatic,
    LidoNFT,
    NodeOperatorRegistry,
    Polygon,
    StakeManagerMock,
    Validator,
    ValidatorFactory,
} from '../typechain';

describe('Starting to test LidoMatic contract', () => {
    let deployer: SignerWithAddress;
    let testers: SignerWithAddress[] = [];
    let lidoMatic: LidoMatic;
    let lidoNFT: LidoNFT;
    let validator: Validator;
    let validatorFactory: ValidatorFactory;
    let nodeOperatorRegistry: NodeOperatorRegistry;
    let mockStakeManager: StakeManagerMock;
    let mockERC20: Polygon;

    let increaseBlockTime: (amountInSeconds: number) => Promise<void>;

    let submit: (
        signer: SignerWithAddress,
        amount: BigNumberish
    ) => Promise<void>;

    let requestWithdraw: (
        signer: SignerWithAddress,
        amount: BigNumberish
    ) => Promise<void>;

    let claimTokens: (
        signer: SignerWithAddress,
        tokenId: BigNumberish
    ) => Promise<void>;

    let addOperator: (
        name: string,
        rewardAddress: string,
        signerPubKey: Uint8Array
    ) => Promise<void>;

    let stakeOperator: (
        id: BigNumberish,
        owner: SignerWithAddress,
        maxDelegation?: string
    ) => Promise<void>;

    let mint: (
        signer: SignerWithAddress,
        amount: BigNumberish
    ) => Promise<void>;

    before(() => {
        mint = async (signer, amount) => {
            const signerERC = mockERC20.connect(signer);
            await signerERC.mint(amount);
        };

        increaseBlockTime = async (amountInSeconds) => {
            const currentBlockNumber = await ethers.provider.getBlockNumber();
            const { timestamp } = await ethers.provider.getBlock(
                currentBlockNumber
            );
            await ethers.provider.send('evm_mine', [
                amountInSeconds + timestamp,
            ]);
        };

        submit = async (signer, amount) => {
            const signerERC20 = mockERC20.connect(signer);
            await signerERC20.approve(lidoMatic.address, amount);

            const signerLidoMatic = lidoMatic.connect(signer);
            await signerLidoMatic.submit(amount);
        };

        requestWithdraw = async (signer, amount) => {
            const signerLidoMatic = lidoMatic.connect(signer);
            await signerLidoMatic.approve(lidoMatic.address, amount);
            await signerLidoMatic.requestWithdraw(amount);
        };

        claimTokens = async (signer, tokenId) => {
            const signerLidoMatic = lidoMatic.connect(signer);
            await signerLidoMatic.claimTokens(tokenId);
        };

        addOperator = async (name, ownerAddress, heimdallPubKey) => {
            await nodeOperatorRegistry.addOperator(
                name,
                ownerAddress,
                heimdallPubKey
            );
        };

        stakeOperator = async (id, signer, maxDelegation) => {
            // get node operator
            const no1 = await nodeOperatorRegistry['getNodeOperator(address)'](
                signer.address
            );
            // approve token to validator contract
            await mockERC20
                .connect(signer)
                .approve(no1.validatorProxy, ethers.utils.parseEther('100'));

            // stake a node operator
            await nodeOperatorRegistry
                .connect(signer)
                .stake(
                    ethers.utils.parseEther('80'),
                    ethers.utils.parseEther('20')
                );
            await nodeOperatorRegistry.setDefaultMaxDelegateLimit(
                ethers.utils.parseEther('10000000000')
            );
            await nodeOperatorRegistry.setMaxDelegateLimit(
                id,
                ethers.utils.parseEther(maxDelegation || '0')
            );
        };
    });

    beforeEach(async () => {
        [deployer, ...testers] = await ethers.getSigners();

        mockERC20 = (await (
            await ethers.getContractFactory('Polygon')
        ).deploy()) as Polygon;
        await mockERC20.deployed();

        lidoNFT = (await upgrades.deployProxy(
            await ethers.getContractFactory('LidoNFT'),
            ['LidoNFT', 'LN']
        )) as LidoNFT;
        await lidoNFT.deployed();

        mockStakeManager = (await (
            await ethers.getContractFactory('StakeManagerMock')
        ).deploy(
            mockERC20.address,
            ethers.constants.AddressZero
        )) as StakeManagerMock;
        await mockStakeManager.deployed();

        validator = (await (
            await ethers.getContractFactory('Validator')
        ).deploy()) as Validator;
        await validator.deployed();

        validatorFactory = (await upgrades.deployProxy(
            await ethers.getContractFactory('ValidatorFactory'),
            [validator.address]
        )) as ValidatorFactory;
        await validatorFactory.deployed();

        nodeOperatorRegistry = (await upgrades.deployProxy(
            await ethers.getContractFactory('NodeOperatorRegistry'),
            [
                validatorFactory.address,
                mockStakeManager.address,
                mockERC20.address,
            ]
        )) as NodeOperatorRegistry;
        await nodeOperatorRegistry.deployed();

        lidoMatic = (await upgrades.deployProxy(
            await ethers.getContractFactory('LidoMatic'),
            [
                nodeOperatorRegistry.address,
                mockERC20.address,
                deployer.address,
                deployer.address,
                mockStakeManager.address,
                lidoNFT.address,
            ]
        )) as LidoMatic;
        await lidoMatic.deployed();

        await lidoNFT.setLido(lidoMatic.address);
        await validatorFactory.setOperator(nodeOperatorRegistry.address);
    });

    it('Should submit successfully', async () => {
        const amount = ethers.utils.parseEther('1');
        await mint(testers[0], amount);
        await submit(testers[0], amount);

        const testerBalance = await lidoMatic.balanceOf(testers[0].address);
        expect(testerBalance.eq(amount)).to.be.true;
    });

    it('Should request withdraw from the contract successfully', async () => {
        const amount = ethers.utils.parseEther('1');
        await mint(testers[0], amount);
        await submit(testers[0], amount);
        await requestWithdraw(testers[0], amount);
        const owned = await lidoNFT.getOwnedTokens(testers[0].address);
        expect(owned).length(1);
    });

    it('Should request withdraw from the validators successfully', async () => {
        const amount = ethers.utils.parseEther('100');
        const amount2Submit = ethers.utils.parseEther('0.05');
        await mint(testers[0], amount);
        await addOperator(
            'BananaOperator',
            testers[0].address,
            ethers.utils.randomBytes(64)
        );
        await stakeOperator(1, testers[0], '10');
        await mint(testers[0], amount2Submit);
        await submit(testers[0], amount2Submit);
        await requestWithdraw(testers[0], ethers.utils.parseEther('0.005'));

        const balance = await lidoNFT.balanceOf(testers[0].address);
        expect(balance.eq(1)).to.be.true;
    });

    it('Should claim tokens after submitting to contract successfully', async () => {
        const submitAmount = ethers.utils.parseEther('0.01');
        const withdrawAmount = ethers.utils.parseEther('0.005');

        await mint(testers[0], submitAmount);
        await submit(testers[0], submitAmount);
        const balanceBefore = await mockERC20.balanceOf(testers[0].address);
        await requestWithdraw(testers[0], withdrawAmount);
        const owned = await lidoNFT.getOwnedTokens(testers[0].address);

        const withdrawalDelay = await mockStakeManager.withdrawalDelay();
        await increaseBlockTime(withdrawalDelay.toNumber());

        await claimTokens(testers[0], owned[0]);
        const balanceAfter = await mockERC20.balanceOf(testers[0].address);

        // expect(balanceAfter.sub(balanceBefore).eq(withdrawAmount)).to.be.true;
    });

    it('Should claim tokens after delegating to validator successfully', async () => {
        const submitAmount = ethers.utils.parseEther('0.01');
        const withdrawAmount = ethers.utils.parseEther('0.005');

        await mint(testers[0], ethers.utils.parseEther('100'));
        await addOperator(
            'BananaOperator',
            testers[0].address,
            ethers.utils.randomBytes(64)
        );
        await stakeOperator(1, testers[0], '100');
        await mint(testers[0], submitAmount);
        await submit(testers[0], submitAmount);
        await lidoMatic.delegate();
        const balanceBefore = await mockERC20.balanceOf(testers[0].address);
        await requestWithdraw(testers[0], withdrawAmount);

        const owned = await lidoNFT.getOwnedTokens(testers[0].address);
        const withdrawalDelay = await mockStakeManager.withdrawalDelay();
        await increaseBlockTime(withdrawalDelay.toNumber());
        await claimTokens(testers[0], owned[0]);
        const balanceAfter = await mockERC20.balanceOf(testers[0].address);

        expect(balanceAfter.sub(balanceBefore).eq(withdrawAmount)).to.be.true;
    });

    // 1 validator, n delegators test
    it('Should delegate and claim tokens from n delegators to 1 validator', async () => {
        const ownedTokens: BigNumber[][] = [];
        const submitAmounts: string[] = [];
        const withdrawAmounts: string[] = [];

        const [minAmount, maxAmount] = [0.005, 0.01];
        const delegatorsAmount = Math.floor(Math.random() * (10 - 1)) + 1;
        await mint(testers[0], ethers.utils.parseEther('100'));

        await addOperator(
            'BananaOperator',
            testers[0].address,
            ethers.utils.randomBytes(64)
        );

        await stakeOperator(1, testers[0], '100');

        for (let i = 0; i < delegatorsAmount; i++) {
            submitAmounts.push(
                (Math.random() * (maxAmount - minAmount) + minAmount).toFixed(3)
            );
            const submitAmountWei = ethers.utils.parseEther(submitAmounts[i]);

            await mint(testers[i], submitAmountWei);
            await submit(testers[i], submitAmountWei);
        }

        await lidoMatic.delegate();

        for (let i = 0; i < delegatorsAmount; i++) {
            withdrawAmounts.push(
                (
                    Math.random() * (Number(submitAmounts[i]) - minAmount) +
                    minAmount
                ).toFixed(3)
            );
            const withdrawAmountWei = ethers.utils.parseEther(
                withdrawAmounts[i]
            );

            await requestWithdraw(testers[i], withdrawAmountWei);
            ownedTokens.push(await lidoNFT.getOwnedTokens(testers[i].address));
        }

        const withdrawalDelay = await mockStakeManager.withdrawalDelay();
        await increaseBlockTime(withdrawalDelay.toNumber());

        for (let i = 0; i < delegatorsAmount; i++) {
            await claimTokens(testers[i], ownedTokens[i][0]);
            const balanceAfter = await mockERC20.balanceOf(testers[i].address);

            expect(balanceAfter.eq(ethers.utils.parseEther(withdrawAmounts[i])))
                .to.be.true;
        }
    });

    // n validator, n delegator test
    it('Should delegate and claim from n delegators to m validators successfully', async () => {
        const ownedTokens: BigNumber[][] = [];
        const submitAmounts: string[] = [];
        const withdrawAmounts: string[] = [];

        const [minAmount, maxAmount] = [0.001, 0.1];
        const delegatorsAmount = Math.floor(Math.random() * (10 - 1)) + 1;
        const testersAmount = Math.floor(Math.random() * (10 - 1)) + 1;
        for (let i = 0; i < delegatorsAmount; i++) {
            await mint(testers[i], ethers.utils.parseEther('100'));

            await addOperator(
                `BananaOperator${i}`,
                testers[i].address,
                ethers.utils.randomBytes(64)
            );

            await stakeOperator(i + 1, testers[i], '10');
        }

        for (let i = 0; i < testersAmount; i++) {
            submitAmounts.push(
                (Math.random() * (maxAmount - minAmount) + minAmount).toFixed(3)
            );
            const submitAmountWei = ethers.utils.parseEther(submitAmounts[i]);

            await mint(testers[i], submitAmountWei);
            await submit(testers[i], submitAmountWei);
        }

        await lidoMatic.delegate();

        for (let i = 0; i < testersAmount; i++) {
            withdrawAmounts.push(
                (
                    Math.random() * (Number(submitAmounts[i]) - minAmount) +
                    minAmount
                ).toFixed(3)
            );
            const withdrawAmountWei = ethers.utils.parseEther(
                withdrawAmounts[i]
            );
            await requestWithdraw(testers[i], withdrawAmountWei);
            ownedTokens.push(await lidoNFT.getOwnedTokens(testers[i].address));
        }

        const withdrawalDelay = await mockStakeManager.withdrawalDelay();
        await increaseBlockTime(withdrawalDelay.toNumber());

        for (let i = 0; i < testersAmount; i++) {
            for (let j = 0; j < ownedTokens[i].length; j++) {
                await claimTokens(testers[i], ownedTokens[i][j]);
            }
            const balanceAfter = await mockERC20.balanceOf(testers[i].address);

            expect(balanceAfter.eq(ethers.utils.parseEther(withdrawAmounts[i])))
                .to.be.true;
        }
    });

    it('Should pause the contract successfully', async () => {
        await lidoMatic.togglePause();
        await expect(lidoMatic.delegate()).to.be.revertedWith(
            'Pausable: paused'
        );
    });
});
