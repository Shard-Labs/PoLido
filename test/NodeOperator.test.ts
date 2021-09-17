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
    let stakeManagerMockContract: Contract;
    let lidoMockContract: Contract;
    let polygonERC20Contract: Contract;

    beforeEach(async function () {
        const accounts = await ethers.getSigners();
        signer = accounts[0]
        user1 = accounts[1]

        // deploy ERC20 token
        const polygonERC20Artifact: Artifact = await hardhat.artifacts.readArtifact("Polygon");
        polygonERC20Contract = await deployContract(signer, polygonERC20Artifact)

        // deploy lido mock contract
        // TODO: change later with the real lido contract.
        const lidoMockArtifact: Artifact = await hardhat.artifacts.readArtifact("ILidoMock");
        lidoMockContract = await deployContract(signer, lidoMockArtifact)

        // deploy stake manager mock
        const stakeManagerMockArtifact: Artifact = await hardhat.artifacts.readArtifact("StakeManagerMock");
        stakeManagerMockContract = await deployContract(
            signer,
            stakeManagerMockArtifact,
            [polygonERC20Contract.address]
        )

        // deploy validator factory
        const validatorFactoryArtifact = await ethers.getContractFactory('ValidatorFactory')
        validatorFactoryContract = await upgrades.deployProxy(
            validatorFactoryArtifact, [], { kind: 'uups' })

        // deploy node operator contract
        const nodeOperatorRegistryArtifact = await ethers.getContractFactory('NodeOperatorRegistry')
        nodeOperatorRegistryContract = await upgrades.deployProxy(
            nodeOperatorRegistryArtifact,
            [
                validatorFactoryContract.address,
                lidoMockContract.address,
                stakeManagerMockContract.address,
                polygonERC20Contract.address
            ],
            { kind: 'uups' }
        )

        await validatorFactoryContract.setOperatorAddress(nodeOperatorRegistryContract.address)
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
        const stats = await nodeOperatorRegistryContract.getState();
        expect(stats[0].toNumber(), 'totalNodeOpearator not match').equal(1);
        expect(stats[1].toNumber(), 'totalActiveNodeOpearator not match').equal(1);

        expect((await validatorFactoryContract.getValidators()).length).to.equal(1)
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
        const stats = await nodeOperatorRegistryContract.getState();
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
        const stats = await nodeOperatorRegistryContract.getState();
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

    it('upgrade validator factory', async function () {
        const version1 = await validatorFactoryContract.version()

        // upgrade contract
        const validatorFactoryV2Artifact = await ethers.getContractFactory('ValidatorFactoryV2')
        await upgrades.upgradeProxy(validatorFactoryContract, validatorFactoryV2Artifact)

        const version2 = await validatorFactoryContract.version()

        expect(version1 === "1.0.0");
        expect(version2 === "2.0.0");
    })
});

function getValidatorFakeData(rewardAddress: string): { name: string; rewardAddress: string; signerPubkey: string } {
    return {
        name: 'node1',
        rewardAddress: rewardAddress,
        signerPubkey: ethers.utils.hexZeroPad('0x01', 64)
    }
}