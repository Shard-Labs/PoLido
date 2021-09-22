import hardhat, { ethers, upgrades } from 'hardhat';
import { Signer, Contract, BigNumber } from 'ethers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { Artifact } from "hardhat/types";

const { deployContract } = hardhat.waffle;

chai.use(solidity);

let signer: Signer;
let user1: Signer;
let user1Address: string;
let user2: Signer;
let user2Address: string;

let nodeOperatorRegistryContract: Contract;
let validatorFactoryContract: Contract;
let stakeManagerMockContract: Contract;
let lidoMockContract: Contract;
let polygonERC20Contract: Contract;
let validatorContract: Contract;

describe('NodeOperator', function () {
    beforeEach(async function () {
        const accounts = await ethers.getSigners();
        signer = accounts[0]
        user1 = accounts[1]
        user2 = accounts[2]
        user1Address = await user1.getAddress()
        user2Address = await user2.getAddress()

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
        const validatorArtifact: Artifact = await hardhat.artifacts.readArtifact("Validator");
        validatorContract = await deployContract(
            signer,
            validatorArtifact,
            []
        )

        // deploy validator factory
        const validatorFactoryArtifact = await ethers.getContractFactory('ValidatorFactory')
        validatorFactoryContract = await upgrades.deployProxy(
            validatorFactoryArtifact, [validatorContract.address], { kind: 'uups' })

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

        await polygonERC20Contract.transfer(await user1.getAddress(), toEth("1000"))
        await polygonERC20Contract.transfer(await user2.getAddress(), toEth("1000"))
    });

    // it('Success', async function () {
    //     // deploy validator factory
    //     try {
    //         const impl1Artifact: Artifact = await hardhat.artifacts.readArtifact("Impl1");
    //         const impl1Contract = await deployContract(signer, impl1Artifact)

    //         const impl2Artifact: Artifact = await hardhat.artifacts.readArtifact("Impl2");
    //         const impl2Contract = await deployContract(signer, impl2Artifact)

    //         const proxyArtifact: Artifact = await hardhat.artifacts.readArtifact("ValidatorProxy");
    //         const proxyContract = await deployContract(
    //             signer,
    //             proxyArtifact,
    //             [
    //                 await user1.getAddress(),
    //                 impl1Contract.address
    //             ]
    //         )
    //         const proxyContract2 = await deployContract(
    //             signer,
    //             proxyArtifact,
    //             [
    //                 await user1.getAddress(),
    //                 impl1Contract.address
    //             ]
    //         )
    //         await user1.sendTransaction({
    //             to: proxyContract.address,
    //             data: new ethers.utils.Interface(impl1Artifact.abi).encodeFunctionData("setName", ["idir"])
    //         })

    //         await user1.sendTransaction({
    //             to: proxyContract2.address,
    //             data: new ethers.utils.Interface(impl1Artifact.abi).encodeFunctionData("setName", ["nassim"])
    //         })

    //         let res = await user1.call({
    //             to: proxyContract.address,
    //             data: new ethers.utils.Interface(impl1Artifact.abi).encodeFunctionData("getName")
    //         })
    //         console.log(new ethers.utils.Interface(impl1Artifact.abi).decodeFunctionResult("getName", res))

    //         res = await user1.call({
    //             to: proxyContract2.address,
    //             data: new ethers.utils.Interface(impl1Artifact.abi).encodeFunctionData("getName")
    //         })

    //         console.log(new ethers.utils.Interface(impl1Artifact.abi).decodeFunctionResult("getName", res))

    //         await proxyContract.connect(user1).setImplementation(impl2Contract.address)
    //         await proxyContract2.connect(user1).setImplementation(impl2Contract.address)

    //         await user1.sendTransaction({
    //             to: proxyContract.address,
    //             data: new ethers.utils.Interface(impl2Artifact.abi).encodeFunctionData("setAge", [30])
    //         })

    //         await user1.sendTransaction({
    //             to: proxyContract2.address,
    //             data: new ethers.utils.Interface(impl2Artifact.abi).encodeFunctionData("setAge", [32])
    //         })

    //         res = await user1.call({
    //             to: proxyContract.address,
    //             data: new ethers.utils.Interface(impl2Artifact.abi).encodeFunctionData("getName")
    //         })
    //         console.log(new ethers.utils.Interface(impl2Artifact.abi).decodeFunctionResult("getName", res))

    //         res = await user1.call({
    //             to: proxyContract2.address,
    //             data: new ethers.utils.Interface(impl2Artifact.abi).encodeFunctionData("getName")
    //         })

    //         console.log(new ethers.utils.Interface(impl2Artifact.abi).decodeFunctionResult("getName", res))

    //         res = await user1.call({
    //             to: proxyContract.address,
    //             data: new ethers.utils.Interface(impl2Artifact.abi).encodeFunctionData("getAge")
    //         })
    //         console.log(new ethers.utils.Interface(impl2Artifact.abi).decodeFunctionResult("getAge", res))

    //         res = await user1.call({
    //             to: proxyContract2.address,
    //             data: new ethers.utils.Interface(impl2Artifact.abi).encodeFunctionData("getAge")
    //         })

    //         console.log(new ethers.utils.Interface(impl2Artifact.abi).decodeFunctionResult("getAge", res))
    //     } catch (e) {
    //         console.log(e)
    //     }
    // })

    it('Success add new operator', async function () {
        const { name, signerPubkey } = await newValidator(1, user1Address)

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
        expect(res[2] === user1Address)
        expect(res[3].toString() === "0")
        expect(res[4] === signerPubkey)
        expect(res[5].toString() === validators[1])
    });

    it('Fails to add new operator permission missing', async function () {
        const { name, signerPubkey } = getValidatorFakeData()

        // change the caller with a user that has no permission.
        await expect(nodeOperatorRegistryContract.connect(user1).addOperator(
            name,
            user1Address,
            signerPubkey
        )).to.revertedWith('Permission not found');
    })

    it('Success remove node operator', async function () {
        await newValidator(1, user1Address)

        // exit node operator
        await nodeOperatorRegistryContract.exitNodeOperator(1)

        // remove node operator.
        const res = await nodeOperatorRegistryContract.removeOperator(1)
        expect(res).to.emit(nodeOperatorRegistryContract, 'RemoveOperator').withArgs(1)

        // check node operator stats
        const stats = await nodeOperatorRegistryContract.getState();
        expect(stats[0].toNumber(), 'totalNodeOpearator not match').equal(0);
        expect(stats[1].toNumber(), 'totalActiveNodeOpearator not match').equal(0);
    })

    it('Fail to remove operator permission missing', async function () {
        const { name, signerPubkey } = getValidatorFakeData()

        // change the caller with a user that has no permission.
        await expect(nodeOperatorRegistryContract.connect(user1).addOperator(
            name,
            user1Address,
            signerPubkey
        )).to.revertedWith('Permission not found');
    })

    it('upgrade contract', async function () {
        await newValidator(1, user1Address)

        // check the actual contract version should be 1.0.0
        expect(await nodeOperatorRegistryContract.version() === '1.0.0')

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

    it('Success get operators id list', async function () {
        await newValidator(1, user1Address)
        await newValidator(2, user1Address)
        expect((await nodeOperatorRegistryContract.getOperators()).length == 2, 'Total validators in the system not match')
    })

    it('Success upgrade validator factory', async function () {
        // before upgrade
        expect(await validatorFactoryContract.version() === "1.0.0");

        // upgrade contract
        const validatorFactoryV2Artifact = await ethers.getContractFactory('ValidatorFactoryV2')
        await upgrades.upgradeProxy(validatorFactoryContract, validatorFactoryV2Artifact)

        // after upgrade
        expect(await validatorFactoryContract.version() === "2.0.0");
    })

    it('Success stake an operator', async function () {
        await newValidator(1, user1Address)
        // add a new node operator
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("100"), toEth("10")))
            .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1, 1)

        const res = await nodeOperatorRegistryContract.getNodeOperator(1, false)
        expect(res[0] == "STAKED")
        expect(res[3].toString() !== "1")
        const stats = await nodeOperatorRegistryContract.getState()
        expect(res[0].toString() == "1", "totalNodeOpearator")
        expect(res[1].toString() == "0", "totalActiveNodeOpearator")
        expect(res[2].toString() == "1", "totalStakedNodeOpearator")
    })

    it('Fail to stake an operator', async function () {
        await newValidator(1, user1Address)

        // revert the amount and heimdall fees are zero
        await expect(nodeOperatorRegistryContract.connect(user1).stake(0, 0))
            .to.revertedWith("Amount or HeimdallFees not enough")

        // revert the caller in this case signer account has not any operator
        await expect(nodeOperatorRegistryContract
            .stake(toEth("100"), toEth("10")))
            .to.revertedWith("Operator not exists")

        // add a new node operator
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("100"), toEth("10")))
            .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1, 1)

        // revert try to stake the same operator 2 times
        await expect(nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("100"), toEth("10")))
            .to.revertedWith("The Operator status is not active")
    })

    it('Success unstake an operator', async function () {
        await newValidator(1, user1Address)

        // add a new node operator
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("100"), toEth("10")))

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
        await newValidator(1, user1Address)

        // revert caller try to unstake a operator that has not yet staked
        await expect(nodeOperatorRegistryContract.connect(user1).unstake())
            .to.revertedWith("The operator status is not staked")

        // add a new node operator
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("100"), toEth("10")))

        // revert caller does not has any node operator
        await expect(nodeOperatorRegistryContract.unstake())
            .to.revertedWith("Operator not exists")
    })

    it('Success topUpFee for a validator', async function () {
        await newValidator(1, user1Address)

        // add a new node operator
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("100"), toEth("10")))

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("10"))

        expect(await nodeOperatorRegistryContract.connect(user1)
            .topUpForFee(toEth("10")))
            .to.emit(nodeOperatorRegistryContract, "TopUpHeimdallFees")
            .withArgs(1, toEth("10"))
    })

    it('Fail topUpFee for a validator', async function () {
        await newValidator(1, user1Address)

        // add a new node operator
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("100"), toEth("10")))

        // revert heimdall fees = 0
        await expect(nodeOperatorRegistryContract.connect(user1).topUpForFee(0))
            .to.revertedWith("HeimdallFee is ZERO")

        // revert the caller has no node operator.
        await expect(nodeOperatorRegistryContract.topUpForFee(toEth("10")))
            .to.revertedWith("Operator not exists")

        // unstake a node operator
        await nodeOperatorRegistryContract.connect(user1).unstake()

        await expect(nodeOperatorRegistryContract.connect(user1).topUpForFee(toEth("10")))
            .to.revertedWith("The operator status is not staked")
    })

    it('Success withdraw validator rewards', async function () {
        await newValidator(1, user1Address)
        await newValidator(2, user2Address)

        {
            // add a new node operator 1
            const no1 = await nodeOperatorRegistryContract.getNodeOperator(1, false)

            // approve token to validator contract 1
            await polygonERC20Contract.connect(user1).approve(no1[6], toEth("110"))

            // stake the first node operator
            await nodeOperatorRegistryContract.connect(user1)
                .stake(toEth("100"), toEth("10"))
        }

        {
            // add a new node operator 2
            const no2 = await nodeOperatorRegistryContract.getNodeOperator(2, false)

            // approve token to validator contract 2
            await polygonERC20Contract.connect(user2).approve(no2[6], toEth("110"))

            // stake the second node operator
            await nodeOperatorRegistryContract.connect(user2)
                .stake(toEth("100"), toEth("10"))
        }

        expect(await lidoMockContract.withdrawRewards())
            .to.emit(lidoMockContract, "LogRewards").withArgs(50, await user1.getAddress())
            .to.emit(lidoMockContract, "LogRewards").withArgs(50, await user2.getAddress());
    })

    it('Fail withdraw validator rewards', async function () {
        await newValidator(1, user1Address)

        // add a new node operator
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("100"), toEth("10"))

        // withdraw rewards
        await expect(nodeOperatorRegistryContract.withdrawRewards())
            .to.revertedWith("Caller is not the lido contract")
    })

    it('Success unstake claim', async function () {
        await newValidator(1, user1Address)
        await newValidator(2, user2Address)


        // unstakeClaim for validator when validator generated reward and is still
        // buffered on the validator contract, his status stay UNSTAKE
        // and it will be updated to EXIT only when the validator rewards are distributed
        {
            const no1 = await nodeOperatorRegistryContract.getNodeOperator(1, false)

            // approve token to validator contract
            await polygonERC20Contract.connect(user1).approve(no1[6], toEth("110"))

            // stake a node operator
            expect(await nodeOperatorRegistryContract.connect(user1)
                .stake(toEth("100"), toEth("10")))
                .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1, 1)

            // unstake a node operator
            expect(await nodeOperatorRegistryContract.connect(user1)
                .unstake())
                .to.emit(nodeOperatorRegistryContract, "UnstakeOperator").withArgs(1)

            let beforeBalance = await polygonERC20Contract.balanceOf(await user1.getAddress())
            expect(await nodeOperatorRegistryContract.connect(user1)
                .unstakeClaim())
                .to.emit(nodeOperatorRegistryContract, "ClaimUnstake")
            let afterBalance = await polygonERC20Contract.balanceOf(await user1.getAddress())

            expect(beforeBalance.toString() !== afterBalance.toString())
        }

        // unstakeClaim for validator when validator has no reward, hist status is set to EXIT
        {
            const no2 = await nodeOperatorRegistryContract.getNodeOperator(2, false)

            // approve token to validator contract
            await polygonERC20Contract.connect(user2).approve(no2[6], toEth("110"))

            // stake a node operator
            expect(await nodeOperatorRegistryContract.connect(user2)
                .stake(toEth("100"), toEth("10")))
                .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(2, 2)

            expect(await nodeOperatorRegistryContract.connect(user2)
                .unstake())
                .to.emit(nodeOperatorRegistryContract, "UnstakeOperator").withArgs(2)

            let beforeBalance = await polygonERC20Contract.balanceOf(await user2.getAddress())
            expect(await nodeOperatorRegistryContract.connect(user2)
                .unstakeClaim())
                .to.emit(nodeOperatorRegistryContract, "ClaimUnstake")

            let afterBalance = await polygonERC20Contract.balanceOf(await user2.getAddress())
            expect(beforeBalance.toString() !== afterBalance.toString())
        }

        // check global state
        expect((await nodeOperatorRegistryContract.getNodeOperator(1, false))[0] == "UNSTAKED", "operator 1 status")
        expect((await nodeOperatorRegistryContract.getNodeOperator(2, false))[0] == "EXIT", "operator 2 status")

        const stats = await nodeOperatorRegistryContract.getState()
        expect(stats[0].toString() == "1", "totalNodeOpearator")
        expect(stats[1].toString() == "0", "totalActiveNodeOpearator")
        expect(stats[2].toString() == "0", "totalStakedNodeOpearator")
        expect(stats[3].toString() == "1", "totalUnstakedNodeOpearator")
        expect(stats[3].toString() == "1", "totalExitNodeOpearator")
    })

    it('Success unjail', async function () {
        await newValidator(1, user1Address)

        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("100"), toEth("10"))

        // unstake a node operator
        await nodeOperatorRegistryContract.connect(user1).unstake()

        // unjail a node operator
        expect(await nodeOperatorRegistryContract.connect(user1).unjail())
        .to.emit(nodeOperatorRegistryContract, "Unjail").withArgs(1, 1);
    })

    it('Fail unjail', async function () {
        await newValidator(1, user1Address)

        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("100"), toEth("10"))

        // revert unjail a node operator that not exists
        await expect(nodeOperatorRegistryContract.connect(user2).unjail())
        .to.revertedWith("Operator not exists")

        // revert unjail a node operator that was not unstaked
        await expect(nodeOperatorRegistryContract.connect(user1).unjail())
        .to.revertedWith("Operator status not UNSTAKED")
    })

    it('Success claim heimdall fees', async function () {
        await newValidator(1, user1Address)

        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("100"), toEth("10"))

        // unstake a node operator
        await nodeOperatorRegistryContract.connect(user1).unstake()

        // claim fees
        await nodeOperatorRegistryContract.connect(user1)
            .claimFee(1, 1, ethers.utils.randomBytes(64))

    })

    it('Fail claim heimdall fees', async function () {

        await newValidator(1, user1Address)

        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("100"), toEth("10"))

        // claim fees before unstake
        await expect(nodeOperatorRegistryContract.connect(user1)
            .claimFee(1, 1, ethers.utils.randomBytes(64)))
            .to.revertedWith("Operator status not UNSTAKED")

        // claim fees of an operator that not exists
        await expect(nodeOperatorRegistryContract.connect(user2)
            .claimFee(1, 1, ethers.utils.randomBytes(64)))
            .to.revertedWith("Operator not exists")

        // unstake a node operator
        await nodeOperatorRegistryContract.connect(user1).unstake()

        // claim fees of an operator that not exists
        await expect(nodeOperatorRegistryContract.connect(user1)
            .claimFee(1, 1, ethers.utils.randomBytes(0)))
            .to.revertedWith("Empty proof")

        // claim fees of an operator that not exists
        await expect(nodeOperatorRegistryContract.connect(user1)
            .claimFee(1, 0, ethers.utils.randomBytes(64)))
            .to.revertedWith("index is ZERO")
    })

    it('Success update all operators commision rate', async function () {
        await newValidator(1, user1Address)

        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("100"), toEth("10"))

        // update commission rate
        expect(await nodeOperatorRegistryContract.updateCommissionRate(10))
            .to.emit(nodeOperatorRegistryContract, "UpdateCommissionRate").withArgs(10);
    })

    it('Success update one operator commision rate', async function () {
        await newValidator(1, user1Address)
        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("100"), toEth("10"))

        // update commission rate
        expect(await nodeOperatorRegistryContract.updateOperatorCommissionRate(1, 10))
            .to.emit(nodeOperatorRegistryContract, "UpdateCommissionRate").withArgs(10);
    })

    it('Fail update one operator commision rate', async function () {
        await newValidator(1, user1Address)
        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("100"), toEth("10"))

        // update commission rate
        await expect(nodeOperatorRegistryContract.updateOperatorCommissionRate(0, 10))
            .to.revertedWith("Operator status no STAKED")
    })

    it('Success update signer publickey', async function () {
        await newValidator(1, user1Address)

        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("110"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("100"), toEth("10"))

        const newSignPubkey = ethers.utils.hexZeroPad('0x02', 64)
        expect(await nodeOperatorRegistryContract.connect(user1)
            .updateSigner(newSignPubkey))
            .to.emit(nodeOperatorRegistryContract, "UpdateSignerPubkey")
        // .withArgs(1, 1, newSignPubkey)

        no = await nodeOperatorRegistryContract.getNodeOperator(1, false)
        expect(newSignPubkey === no[4], "Signer pubkey not match")
    })
});

// generate fake data for validator
function getValidatorFakeData(): { name: string; signerPubkey: string } {
    return {
        name: 'node1',
        signerPubkey: ethers.utils.hexZeroPad('0x01', 64)
    }
}

// create a new validator
async function newValidator(_id: number, userAddress: string, signer?: Signer) {
    const { name, signerPubkey } = getValidatorFakeData()

    // add new node operator
    expect(await nodeOperatorRegistryContract.addOperator(
        name,
        userAddress,
        signerPubkey
    )).to.emit(nodeOperatorRegistryContract, 'NewOperator').withArgs(
        _id, name, signerPubkey, 0
    )
    return { name, signerPubkey }
}

// convert a string to ether
function toEth(amount: string): BigNumber {
    return ethers.utils.parseEther(amount)
}