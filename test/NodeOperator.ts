import { ethers, upgrades } from 'hardhat';
import { Signer, Contract } from 'ethers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';

chai.use(solidity);

describe('NodeOperator', function () {
    let signer: Signer;
    let user1: Signer;
    let NodeOperatorRegistryContract: Contract;

    beforeEach(async function () {
        const accounts = await ethers.getSigners();
        signer = accounts[0]
        user1 = accounts[1]

        // deploy contract
        const NodeOperatorRegistryArtifact = await ethers.getContractFactory('NodeOperatorRegistry')
        NodeOperatorRegistryContract = await upgrades.deployProxy(NodeOperatorRegistryArtifact, [], { kind: 'uups' })
    });

    it('add new operator fails permission missing', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // change the caller with a user that has no permission.
        await expect(NodeOperatorRegistryContract.connect(user1).addOperator(
            name,
            rewardAddress,
            signerPubkey
        )).to.revertedWith('Permission not found');
    })

    it('add new operator success', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // add new node operator
        const res = await NodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );
        expect(res).to.emit(NodeOperatorRegistryContract, 'NewOperator').withArgs(
            1, name, signerPubkey, 0
        )

        // check node operator stats
        const stats = await NodeOperatorRegistryContract.nodeOperatorRegistryStats();
        expect(stats[0].toNumber(), 'totalNodeOpearator not match').equal(1);
        expect(stats[1].toNumber(), 'totalActiveNodeOpearator not match').equal(1);
    });

    it('remove operator fails permission missing', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // change the caller with a user that has no permission.
        await expect(NodeOperatorRegistryContract.connect(user1).addOperator(
            name,
            rewardAddress,
            signerPubkey
        )).to.revertedWith('Permission not found');
    })

    it('remove node operator success', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // add new node operator
        await NodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );

        // remove node operator.
        const res = await NodeOperatorRegistryContract.removeOperator(1)
        expect(res).to.emit(NodeOperatorRegistryContract, 'RemoveOperator').withArgs(1)

        // check node operator stats
        const stats = await NodeOperatorRegistryContract.nodeOperatorRegistryStats();
        // totalNodeOpearator = 0
        expect(stats[0].toNumber(), 'totalNodeOpearator not match').equal(0);
        // totalActiveNodeOpearator = 0
        expect(stats[1].toNumber(), 'totalActiveNodeOpearator not match').equal(0);
    })

    it('upgrade contract', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // add new node operator
        await NodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );

        // check the actual contract version should be 1.0.0
        expect(await NodeOperatorRegistryContract.version() !== '2.0.0')

        // upgrade the contract to v2
        const NodeOperatorRegistryV2Artifact = await ethers.getContractFactory('NodeOperatorRegistryV2')
        await upgrades.upgradeProxy(NodeOperatorRegistryContract.address, NodeOperatorRegistryV2Artifact)

        // check the actual contract version should be 2.0.0
        expect(await NodeOperatorRegistryContract.version() === '2.0.0')

        // check node operator stats
        const stats = await NodeOperatorRegistryContract.nodeOperatorRegistryStats();
        expect(stats[0].toNumber(), 'totalNodeOpearator not match').equal(1);
        expect(stats[1].toNumber(), 'totalActiveNodeOpearator not match').equal(1);
    })

    it('get operators id list', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // add new node operator
        await NodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );

        // add new node operator
        await NodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );
        expect((await NodeOperatorRegistryContract.getOperators()).length == 2, 'Total validators in the system not match')
    })
});

function getValidatorFakeData(rewardAddress: string): { name: string; rewardAddress: string; signerPubkey: string } {
    return {
        name: 'node1',
        rewardAddress: rewardAddress,
        signerPubkey: ethers.utils.hexZeroPad('0x01', 64)
    }
}