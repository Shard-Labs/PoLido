import hardhat, { ethers, upgrades } from 'hardhat';
import { Signer, Contract } from 'ethers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { Artifact } from "hardhat/types";

const { deployContract } = hardhat.waffle;

chai.use(solidity);

describe('NodeOperator', function () {
    let signer: Signer;
    let user1: Signer;
    let nodeOperatorRegistryContract: Contract;
    let validatorFactoryContract: Contract;
    let validatorContract: Contract;
    let stakeManagerContract: Contract;

    beforeEach(async function () {
        const accounts = await ethers.getSigners();
        signer = accounts[0]
        user1 = accounts[1]

        // deploy contracts
        const stakeManagerArtifact: Artifact = await hardhat.artifacts.readArtifact("StakeManagerMock");
        stakeManagerContract = await deployContract(signer, stakeManagerArtifact)

        const validatorArtifact: Artifact = await hardhat.artifacts.readArtifact("Validator");
        validatorContract = await deployContract(signer, validatorArtifact)

        const validatorFactoryArtifact = await ethers.getContractFactory('ValidatorFactory')
        validatorFactoryContract = await upgrades.deployProxy(validatorFactoryArtifact, [validatorContract.address], { kind: 'uups' })

        const nodeOperatorRegistryArtifact = await ethers.getContractFactory('NodeOperatorRegistry')
        nodeOperatorRegistryContract = await upgrades.deployProxy(
            nodeOperatorRegistryArtifact,
            [validatorFactoryContract.address, stakeManagerContract.address],
            { kind: 'uups' }
        )
    });

    it('add new operator fails permission missing', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // change the caller with a user that has no permission.
        await expect(nodeOperatorRegistryContract.connect(user1).addOperator(
            name,
            rewardAddress,
            signerPubkey
        )).to.revertedWith('Permission not found');
    })

    it('add new operator success', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // add new node operator
        const res = await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );
        expect(res).to.emit(nodeOperatorRegistryContract, 'NewOperator').withArgs(
            1, name, signerPubkey, 0
        )

        // check node operator stats
        const stats = await nodeOperatorRegistryContract.nodeOperatorRegistryStats();
        expect(stats[0].toNumber(), 'totalNodeOpearator not match').equal(1);
        expect(stats[1].toNumber(), 'totalActiveNodeOpearator not match').equal(1);
    });

    it('remove operator fails permission missing', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // change the caller with a user that has no permission.
        await expect(nodeOperatorRegistryContract.connect(user1).addOperator(
            name,
            rewardAddress,
            signerPubkey
        )).to.revertedWith('Permission not found');
    })

    it('remove node operator success', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // add new node operator
        await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );

        // remove node operator.
        const res = await nodeOperatorRegistryContract.removeOperator(1)
        expect(res).to.emit(nodeOperatorRegistryContract, 'RemoveOperator').withArgs(1)

        // check node operator stats
        const stats = await nodeOperatorRegistryContract.nodeOperatorRegistryStats();
        // totalNodeOpearator = 0
        expect(stats[0].toNumber(), 'totalNodeOpearator not match').equal(0);
        // totalActiveNodeOpearator = 0
        expect(stats[1].toNumber(), 'totalActiveNodeOpearator not match').equal(0);
    })

    it('upgrade contract', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // add new node operator
        await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );

        // check the actual contract version should be 1.0.0
        expect(await nodeOperatorRegistryContract.version() !== '2.0.0')

        // upgrade the contract to v2
        const NodeOperatorRegistryV2Artifact = await ethers.getContractFactory('NodeOperatorRegistryV2')
        await upgrades.upgradeProxy(nodeOperatorRegistryContract.address, NodeOperatorRegistryV2Artifact)

        // check the actual contract version should be 2.0.0
        expect(await nodeOperatorRegistryContract.version() === '2.0.0')

        // check node operator stats
        const stats = await nodeOperatorRegistryContract.nodeOperatorRegistryStats();
        expect(stats[0].toNumber(), 'totalNodeOpearator not match').equal(1);
        expect(stats[1].toNumber(), 'totalActiveNodeOpearator not match').equal(1);
    })

    it('get operators id list', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // add new node operator
        await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );

        // add new node operator
        await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );
        expect((await nodeOperatorRegistryContract.getOperators()).length == 2, 'Total validators in the system not match')
    })

    it('deploy validator contracts', async function () {
        await validatorFactoryContract.create(stakeManagerContract.address);
        await validatorFactoryContract.create(stakeManagerContract.address);
        await validatorFactoryContract.create(stakeManagerContract.address);

        const validators = await validatorFactoryContract.getValidatorAddress()
        expect(validators.length === 3, 'Validators count should be 3')
    })
});

function getValidatorFakeData(rewardAddress: string): { name: string; rewardAddress: string; signerPubkey: string } {
    return {
        name: 'node1',
        rewardAddress: rewardAddress,
        signerPubkey: ethers.utils.hexZeroPad('0x01', 64)
    }
}