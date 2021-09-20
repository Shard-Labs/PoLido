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
    let user2: Signer;
    let nodeOperatorRegistryContract: Contract;
    let validatorFactoryContract: Contract;
    let stakeManagerMockContract: Contract;
    let lidoMockContract: Contract;
    let polygonERC20Contract: Contract;

    beforeEach(async function () {
        const accounts = await ethers.getSigners();
        signer = accounts[0]
        user1 = accounts[1]
        user2 = accounts[2]

        // deploy ERC20 token
        const polygonERC20Artifact: Artifact = await hardhat.artifacts.readArtifact("Polygon");
        polygonERC20Contract = await deployContract(signer, polygonERC20Artifact)

        // deploy lido mock contract
        // TODO: change later with the real lido contract.
        const lidoMockArtifact: Artifact = await hardhat.artifacts.readArtifact("LidoMock");
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
        await lidoMockContract.setOperator(nodeOperatorRegistryContract.address)

        // transfer some funds to the stake manager, so we can use it to withdraw rewards.
        await polygonERC20Contract.transfer(
            stakeManagerMockContract.address,
            ethers.utils.parseEther("10000")
        )

    });

    it('Success add new operator', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // add new node operator
        expect(await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        )).to.emit(nodeOperatorRegistryContract, 'NewOperator').withArgs(
            1, name, signerPubkey, 0
        )

        // check node operator stats
        const stats = await nodeOperatorRegistryContract.getState();
        expect(stats[0].toNumber(), 'totalNodeOpearator not match').equal(1);
        expect(stats[1].toNumber(), 'totalActiveNodeOpearator not match').equal(1);

        // get validators address deployed by the factory
        const validators = await validatorFactoryContract.getValidators()

        // get operator data
        const res = await nodeOperatorRegistryContract.getNodeOperator(1, true)
        expect(res[0] === 'ACTIVE')
        expect(res[1] === name)
        expect(res[2] === rewardAddress)
        expect(res[3].toString() === "0")
        expect(res[4] === signerPubkey)
        expect(res[5].toString() === validators[1])
    });

    it('Fails to add new operator permission missing', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // change the caller with a user that has no permission.
        await expect(nodeOperatorRegistryContract.connect(user1).addOperator(
            name,
            rewardAddress,
            signerPubkey
        )).to.revertedWith('Permission not found');
    })

    it('Success remove node operator', async function () {
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

    it('Fail to remove operator permission missing', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // change the caller with a user that has no permission.
        await expect(nodeOperatorRegistryContract.connect(user1).addOperator(
            name,
            rewardAddress,
            signerPubkey
        )).to.revertedWith('Permission not found');
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

    it('Success stake an operator', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())
        // add new node operator
        await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );

        // add a new node operator
        await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1).stake(100, 10))
            .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1)

        const res = await nodeOperatorRegistryContract.getNodeOperator(1, false)
        expect(res[0] == "STAKED")
        expect(res[3].toString() !== "0")

        const stats = await nodeOperatorRegistryContract.getState()
        expect(res[0].toString() == "1", "totalNodeOpearator")
        expect(res[1].toString() == "0", "totalActiveNodeOpearator")
        expect(res[2].toString() == "1", "totalStakedNodeOpearator")
    })

    it('Fail to stake an operator', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())
        // add new node operator
        await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );

        // add a new node operator
        await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // revert the amount and heimdall fees are zero
        await expect(nodeOperatorRegistryContract.connect(user1).stake(0, 0))
            .to.revertedWith("Amount or HeimdallFees should not be ZERO")

        // revert the caller in this case signer account has not any operator
        await expect(nodeOperatorRegistryContract.stake(100, 10))
            .to.revertedWith("Operator not exists")

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1).stake(100, 10))
            .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1)

        // revert try to stake the same operator 2 times
        await expect(nodeOperatorRegistryContract.connect(user1).stake(100, 10))
            .to.revertedWith("The Operator status is not active")
    })

    it('Success unstake an operator', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())
        // add new node operator
        await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );

        // add a new node operator
        await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1).stake(100, 10))
            .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1)

        // unstake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1).unstake())

        const res = await nodeOperatorRegistryContract.getNodeOperator(1, false)
        expect(res[0] == "UNSTAKED")

        const stats = await nodeOperatorRegistryContract.getState()
        expect(res[0].toString() == "1", "totalNodeOpearator")
        expect(res[1].toString() == "0", "totalActiveNodeOpearator")
        expect(res[2].toString() == "0", "totalStakedNodeOpearator")
        expect(res[3].toString() == "1", "totalUnstakedNodeOpearator")
    })

    it('Fail unstake an operator', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())
        // add new node operator
        await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );

        // add a new node operator
        await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // revert caller try to unstake a operator that has not yet staked
        await expect(nodeOperatorRegistryContract.connect(user1).unstake())
            .to.revertedWith("The operator status is not staked")

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1).stake(100, 10))
            .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1)

        // revert caller does not has any node operator
        await expect(nodeOperatorRegistryContract.unstake())
            .to.revertedWith("Operator not exists")
    })

    it('Success topUpFee for a validator', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())
        // add new node operator
        await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );
        // add a new node operator
        await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1).stake(100, 10))
            .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1)

        expect(await nodeOperatorRegistryContract.connect(user1).topUpForFee(10))
            .to.emit(nodeOperatorRegistryContract, "TopUpHeimdallFees")
            .withArgs(1, 10)
    })

    it('Fail topUpFee for a validator', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())
        // add new node operator
        await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );
        // add a new node operator
        await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1).stake(100, 10))
            .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1)

        // revert heimdall fees = 0
        await expect(nodeOperatorRegistryContract.connect(user1).topUpForFee(0))
            .to.revertedWith("HeimdallFee is ZERO")

        // revert the caller has no node operator.
        await expect(nodeOperatorRegistryContract.topUpForFee(10))
            .to.revertedWith("Operator not exists")

        // unstake a node operator
        await nodeOperatorRegistryContract.connect(user1).unstake()

        await expect(nodeOperatorRegistryContract.connect(user1).topUpForFee(10))
            .to.revertedWith("The operator status is not staked")
    })

    it('Success withdraw validator rewards', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // add first node operator
        expect(await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        )).to.emit(nodeOperatorRegistryContract, 'NewOperator').withArgs(
            1, name, signerPubkey, 0
        )

        // add second node operator
        expect(await nodeOperatorRegistryContract.addOperator(
            name,
            await user2.getAddress(),
            signerPubkey
        )).to.emit(nodeOperatorRegistryContract, 'NewOperator').withArgs(
            2, name, signerPubkey, 0
        )

        // stake the first node operator
        await nodeOperatorRegistryContract.connect(user1).stake(100, 10)

        // stake the second node operator
        await nodeOperatorRegistryContract.connect(user2).stake(100, 10)

        expect(await lidoMockContract.withdrawRewards())
            .to.emit(lidoMockContract, "LogRewards").withArgs(50, await user1.getAddress())
            .to.emit(lidoMockContract, "LogRewards").withArgs(50, await user2.getAddress());
    })

    it('Fail withdraw validator rewards', async function () {
        const { name, rewardAddress, signerPubkey } = getValidatorFakeData(await user1.getAddress())

        // add new node operator
        expect(await nodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        )).to.emit(nodeOperatorRegistryContract, 'NewOperator').withArgs(
            1, name, signerPubkey, 0
        )

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(100, 10)

        // withdraw rewards
        await expect(nodeOperatorRegistryContract.withdrawRewards())
            .to.revertedWith("Caller is not the lido contract")
    })
});

function getValidatorFakeData(rewardAddress: string): { name: string; rewardAddress: string; signerPubkey: string } {
    return {
        name: 'node1',
        rewardAddress: rewardAddress,
        signerPubkey: ethers.utils.hexZeroPad('0x01', 64)
    }
}