import hardhat, { ethers, upgrades } from 'hardhat';
import { Signer, Contract, BigNumber } from 'ethers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { Artifact } from "hardhat/types";

const { deployContract } = hardhat.waffle;

chai.use(solidity);

let signer: Signer;
let signerAddress: string;
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
let ZERO_ADDRESS = ethers.constants.AddressZero

describe('NodeOperator', function () {
    beforeEach(async function () {
        const accounts = await ethers.getSigners();
        signer = accounts[0]
        user1 = accounts[1]
        user2 = accounts[2]
        user1Address = await user1.getAddress()
        user2Address = await user2.getAddress()
        signerAddress = await signer.getAddress()

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

        await nodeOperatorRegistryContract.grantRole(ethers.utils.formatBytes32String("ADD_OPERATOR"), signerAddress)
        await nodeOperatorRegistryContract.grantRole(ethers.utils.formatBytes32String("REMOVE_OPERATOR"), signerAddress)
        await nodeOperatorRegistryContract.grantRole(ethers.utils.formatBytes32String("EXIT_OPERATOR"), signerAddress)
        await nodeOperatorRegistryContract.grantRole(ethers.utils.formatBytes32String("UPGRADE_OPERATOR"), signerAddress)
        await nodeOperatorRegistryContract.grantRole(ethers.utils.formatBytes32String("UPDATE_COMMISION_RATE_OPERATOR"), signerAddress)

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
    
    it('Success add new operator', async function () {
        try {
            const { name, signerPubkey } = await newValidator(1, user1Address)

            // check node operator state
            const state = await nodeOperatorRegistryContract.getState();
            expect(state[0].toNumber(), 'totalNodeOpearator not match').equal(1);
            expect(state[1].toNumber(), 'totalActiveNodeOpearator not match').equal(1);

            // get validators address deployed by the factory
            const validators = await validatorFactoryContract.getValidators()

            // get operator data
            const res = await nodeOperatorRegistryContract.getNodeOperator(1, true)
            expect(res[0], "operator status").to.equal(1)
            expect(res[1], "operator name").to.equal(name)
            expect(res[2], "operator reward address").to.equal(user1Address)
            expect(res[3].toString(), "operator validatorId").to.equal("0")
            expect(res[4], "operator signer public key").to.equal(signerPubkey)
            expect(res[5], "operator validator share address").to.equal(ethers.constants.AddressZero)
            expect(res[6], "operator validator contract address").to.equal(validators[0])

        } catch (e) {
            console.log(e)
        }
    });

    it('Fails to add new operator', async function () {
        const { name, signerPubkey } = getValidatorFakeData()

        // revert the caller has no permission.
        await expect(nodeOperatorRegistryContract.connect(user1).addOperator(
            name,
            user1Address,
            signerPubkey
        )).to.revertedWith('Permission not found');

        // revert signer pubkey not valid should be 64.
        await expect(nodeOperatorRegistryContract.addOperator(
            name,
            user1Address,
            ethers.utils.hexZeroPad('0x0', 32)
        )).to.revertedWith('Invalid Public Key');

        // revert reward address is zero.
        await expect(nodeOperatorRegistryContract.addOperator(
            name,
            ethers.constants.AddressZero,
            signerPubkey
        )).to.revertedWith('Invalid reward address');

        // add operator 
        await newValidator(1, user1Address)

        // revert user try to add another operator with the same reward address
        await expect(nodeOperatorRegistryContract.addOperator(
            name,
            user1Address,
            signerPubkey
        )).to.revertedWith("Address already used");
    })

    it('Success get operators list', async function () {
        await newValidator(1, user1Address)
        await newValidator(2, user2Address)

        const ops = await nodeOperatorRegistryContract.getOperators()
        expect(ops.length, 'Total validators in the system not match').to.equal(2)
    })

    it('Success stake an operator', async function () {
        try {

            // add a new node operator
            await newValidator(1, user1Address)

            // get node operator
            const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

            // approve token to validator contract
            await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

            // stake a node operator
            expect(await nodeOperatorRegistryContract.connect(user1)
                .stake(toEth("10"), toEth("20")))
                .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1, 1)

            // get node operator after staked
            const res = await nodeOperatorRegistryContract.getNodeOperator(1, false)
            expect(res[0], "operator status not staked").to.equal(2)
            expect(res[3].toString(), "operator validator id").to.equal("1")
            expect(res[5].toString(), "operator validator share contract").not.equal(ethers.constants.AddressZero.toString())

            // check global state
            const state = await nodeOperatorRegistryContract.getState()
            expect(state[0].toString(), "totalNodeOpearator").to.equal("1")
            expect(state[1].toString(), "totalActiveNodeOpearator").to.equal("0")
            expect(state[2].toString(), "totalStakedNodeOpearator").to.equal("1")
            expect(state[3].toString(), "totalUnstakedNodeOpearator").to.equal("0")
            expect(state[4].toString(), "totalExitNodeOpearator").to.equal("0")
        } catch (e) {
            console.log(e)
        }

    })

    it('Fail to stake an operator', async function () {
        try {

            // add a new node operator
            await newValidator(1, user1Address)

            // revert the amount and heimdall fees are zero.
            await expect(nodeOperatorRegistryContract.connect(user1).stake(toEth("0"), toEth("20")))
                .to.revertedWith("Invalid amount")

            // revert the amount and heimdall fees are zero.
            await expect(nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("0")))
                .to.revertedWith("Invalid heimdallFee")

            // revert the caller is not the owner(owner is user1 and here the signer is the caller).
            await expect(nodeOperatorRegistryContract
                .stake(toEth("10"), toEth("20")))
                .to.revertedWith("Operator not exists")

            // get node operator
            const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

            // approve token to validator contract
            await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

            // stake a node operator
            expect(await nodeOperatorRegistryContract.connect(user1)
                .stake(toEth("10"), toEth("20")))
                .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1, 1)

            // revert try to stake the same operator 2 times
            await expect(nodeOperatorRegistryContract.connect(user1)
                .stake(toEth("10"), toEth("20")))
                .to.revertedWith("The Operator status is not active")
        } catch (e) {
            console.log(e)
        }
    })

    it('Success get operators validatorShare contracts', async function () {
        // add a new node operator
        await newValidator(1, user1Address)
        await newValidator(2, user2Address)

        // get node operator
        const no1 = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no1[6], toEth("30"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("10"), toEth("20")))
            .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1, 1)

        // get node operator
        const no2 = await nodeOperatorRegistryContract.getNodeOperator(2, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user2).approve(no2[6], toEth("30"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user2)
            .stake(toEth("10"), toEth("20")))
            .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(2, 2)

        const operatorShares = await nodeOperatorRegistryContract.getOperatorShares()
        expect(operatorShares.length).to.equal(2)

        for (let idx = 0; idx < operatorShares.length; idx++) {
            expect(operatorShares[idx][1]).not.equal(ZERO_ADDRESS)
        }

        expect(await nodeOperatorRegistryContract.getOperatorShare(1)).not.equal(ZERO_ADDRESS)
    })
    
    it('Success unstake an operator', async function () {
        // add a new node operator
        await newValidator(1, user1Address)

        // get an operator by id
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("10"), toEth("20")))

        // unstake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1).unstake())

        // chez=ck if the status is unstaked === 3
        const res = await nodeOperatorRegistryContract.getNodeOperator(1, false)
        expect(res[0], "operator status").to.equal(3)

        // check global state
        const state = await nodeOperatorRegistryContract.getState()
        expect(state[0].toString(), "totalNodeOpearator").to.equal("1")
        expect(state[1].toString(), "totalActiveNodeOpearator").to.equal("0")
        expect(state[2].toString(), "totalStakedNodeOpearator").to.equal("0")
        expect(state[3].toString(), "totalUnstakedNodeOpearator").to.equal("1")
        expect(state[4].toString(), "totalExitNodeOpearator").to.equal("0")
    })

    it('Fail unstake an operator', async function () {
        // add a new node operator
        await newValidator(1, user1Address)

        // revert caller try to unstake a operator that has not yet staked
        await expect(nodeOperatorRegistryContract.connect(user1).unstake())
            .to.revertedWith("The operator status is not STAKED")

        // add a new node operator
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("10"), toEth("20")))

        // revert caller does not has any node operator
        await expect(nodeOperatorRegistryContract.unstake())
            .to.revertedWith("Operator not exists")
    })

    it('Success topUpFee for a validator', async function () {
        // add a new node operator
        await newValidator(1, user1Address)

        // get a node operator
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("10"), toEth("20")))

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("20"))

        expect(await nodeOperatorRegistryContract.connect(user1)
            .topUpForFee(toEth("20")))
            .to.emit(nodeOperatorRegistryContract, "TopUpHeimdallFees")
            .withArgs(1, toEth("20"))
    })

    it('Fail topUpFee for a validator', async function () {
        // add a new node operator
        await newValidator(1, user1Address)

        // get a node operator
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("10"), toEth("20")))

        // revert heimdall fees = 0
        await expect(nodeOperatorRegistryContract.connect(user1).topUpForFee(0))
            .to.revertedWith("HeimdallFee is ZERO")

        // revert the caller has no node operator.
        await expect(nodeOperatorRegistryContract.topUpForFee(toEth("20")))
            .to.revertedWith("Operator not exists")

        // unstake a node operator
        await nodeOperatorRegistryContract.connect(user1).unstake()

        // revert topup on a no staked operator
        await expect(nodeOperatorRegistryContract.connect(user1).topUpForFee(toEth("20")))
            .to.revertedWith("The operator status is not STAKED")
    })

    it('Success withdraw validator rewards', async function () {
        await newValidator(1, user1Address)
        await newValidator(2, user2Address)

        try {

            {
                // add a new node operator 1
                const no1 = await nodeOperatorRegistryContract.getNodeOperator(1, false)

                // approve token to validator contract 1
                await polygonERC20Contract.connect(user1).approve(no1[6], toEth("30"))

                // stake the first node operator
                await nodeOperatorRegistryContract.connect(user1)
                    .stake(toEth("10"), toEth("20"))
            }

            {
                // add a new node operator 2
                const no2 = await nodeOperatorRegistryContract.getNodeOperator(2, false)

                // approve token to validator contract 2
                await polygonERC20Contract.connect(user2).approve(no2[6], toEth("30"))

                // stake the second node operator
                await nodeOperatorRegistryContract.connect(user2)
                    .stake(toEth("10"), toEth("20"))
            }

            expect(await lidoMockContract.withdrawRewards())
                .to.emit(lidoMockContract, "LogRewards").withArgs(50, await user1.getAddress())
                .to.emit(lidoMockContract, "LogRewards").withArgs(50, await user2.getAddress());
        } catch (e) {
            console.log(e)
        }
    })

    it('Fail withdraw validator rewards', async function () {
        await newValidator(1, user1Address)

        // add a new node operator
        const no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        // withdraw rewards
        await expect(nodeOperatorRegistryContract.withdrawRewards())
            .to.revertedWith("Caller is not the lido contract")
    })

    it('Success unstake claim', async function () {
        // add a new node operator
        await newValidator(1, user1Address)

        // get a node operator
        let no1 = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no1[6], toEth("30"))

        // stake a node operator
        expect(await nodeOperatorRegistryContract.connect(user1)
            .stake(toEth("10"), toEth("20")))
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

        expect(beforeBalance.toString()).not.equal(afterBalance.toString())

        // check global state
        no1 = await nodeOperatorRegistryContract.getNodeOperator(1, false)
        expect(no1[0], "operator status").to.equal(4)

        const state = await nodeOperatorRegistryContract.getState()
        expect(state[0].toString(), "totalNodeOpearator").to.equal("1")
        expect(state[1].toString(), "totalActiveNodeOpearator").to.equal("0")
        expect(state[2].toString(), "totalStakedNodeOpearator").to.equal("0")
        expect(state[3].toString(), "totalUnstakedNodeOpearator").to.equal("0")
        expect(state[4].toString(), "totalExitNodeOpearator").to.equal("1")
    })

    it('Success unjail', async function () {
        // add a new node operator
        await newValidator(1, user1Address)

        // get a node operator
        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        // unstake a node operator
        await nodeOperatorRegistryContract.connect(user1).unstake()

        // unjail a node operator
        expect(await nodeOperatorRegistryContract.connect(user1).unjail())
            .to.emit(nodeOperatorRegistryContract, "Unjail").withArgs(1, 1);

        const state = await nodeOperatorRegistryContract.getState()
        expect(state[0].toString(), "totalNodeOpearator").to.equal("1")
        expect(state[1].toString(), "totalActiveNodeOpearator").to.equal("0")
        expect(state[2].toString(), "totalStakedNodeOpearator").to.equal("1")
        expect(state[3].toString(), "totalUnstakedNodeOpearator").to.equal("0")
        expect(state[4].toString(), "totalExitNodeOpearator").to.equal("0")
    })

    it('Fail unjail', async function () {
        // add a new node operator
        await newValidator(1, user1Address)

        // get a node operator
        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        // revert unjail a node operator that not exists
        await expect(nodeOperatorRegistryContract.connect(user2).unjail())
            .to.revertedWith("Operator not exists")

        // revert unjail a node operator that was not unstaked
        await expect(nodeOperatorRegistryContract.connect(user1).unjail())
            .to.revertedWith("Operator status not UNSTAKED")
    })

    it('Success claim heimdall fees', async function () {
        // add a new node operator
        await newValidator(1, user1Address)

        // get a node operator
        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        // unstake a node operator
        await nodeOperatorRegistryContract.connect(user1).unstake()

        // unstakeClaim a node operator
        await nodeOperatorRegistryContract.connect(user1).unstakeClaim()

        // claim fees
        await nodeOperatorRegistryContract.connect(user1)
            .claimFee(1, 1, ethers.utils.randomBytes(64))

    })

    it('Fail claim heimdall fees', async function () {

        // add a new node operator
        await newValidator(1, user1Address)

        // get a node operator
        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        // claim fees before unstake
        await expect(nodeOperatorRegistryContract.connect(user1)
            .claimFee(1, 1, ethers.utils.randomBytes(64)))
            .to.revertedWith("Operator status not EXIT")

        // claim fees of an operator that not exists
        await expect(nodeOperatorRegistryContract.connect(user2)
            .claimFee(1, 1, ethers.utils.randomBytes(64)))
            .to.revertedWith("Operator not exists")

        // unstake a node operator
        await nodeOperatorRegistryContract.connect(user1).unstake()


        // unstakeClaim a node operator
        await nodeOperatorRegistryContract.connect(user1).unstakeClaim()

        // claim fees of an operator that not exists
        await expect(nodeOperatorRegistryContract.connect(user1)
            .claimFee(1, 1, ethers.utils.randomBytes(0)))
            .to.revertedWith("Empty proof")

        // claim fees of an operator that not exists
        await expect(nodeOperatorRegistryContract.connect(user1)
            .claimFee(1, 0, ethers.utils.randomBytes(64)))
            .to.revertedWith("index is ZERO")
    })

    it('Success update operator commision rate', async function () {
        await newValidator(1, user1Address)
        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        // update commission rate
        expect(await nodeOperatorRegistryContract.updateOperatorCommissionRate(1, 10))
            .to.emit(nodeOperatorRegistryContract, "UpdateCommissionRate").withArgs(10);
    })

    it('Fail update one operator commision rate', async function () {
        await newValidator(1, user1Address)
        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        // update commission rate
        await expect(nodeOperatorRegistryContract.updateOperatorCommissionRate(0, 10))
            .to.revertedWith("Operator status no STAKED")
    })

    it('Success update signer publickey', async function () {
        await newValidator(1, user1Address)

        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        const newSignPubkey = ethers.utils.hexZeroPad('0x02', 64)
        expect(await nodeOperatorRegistryContract.connect(user1)
            .updateSigner(newSignPubkey))
            .to.emit(nodeOperatorRegistryContract, "UpdateSignerPubkey")

        no = await nodeOperatorRegistryContract.getNodeOperator(1, false)
        expect(newSignPubkey === no[4], "Signer pubkey not match")
    })

    it('Success remove node operator', async function () {
        // add a new node operator
        await newValidator(1, user1Address)
        await newValidator(2, user2Address)

        // get a node operator
        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        // unstake a node operator
        await nodeOperatorRegistryContract.connect(user1).unstake()

        // unstakeClaim a node operator
        await nodeOperatorRegistryContract.connect(user1).unstakeClaim()

        // claim fees
        await nodeOperatorRegistryContract.connect(user1)
            .claimFee(1, 1, ethers.utils.randomBytes(64))

        // remove node operator.
        const res = await nodeOperatorRegistryContract.removeOperator(1)
        expect(res).to.emit(nodeOperatorRegistryContract, 'RemoveOperator').withArgs(1)

        const ops = await nodeOperatorRegistryContract.getOperators()
        expect(ops.length, "all validators ids").to.equal(1)
        expect(ops[0].toString(), "validator id 2").to.equal("2")

        // check global state
        const state = await nodeOperatorRegistryContract.getState()
        expect(state[0].toString(), "totalNodeOpearator").to.equal("1")
        expect(state[1].toString(), "totalActiveNodeOpearator").to.equal("1")
        expect(state[2].toString(), "totalStakedNodeOpearator").to.equal("0")
        expect(state[3].toString(), "totalUnstakedNodeOpearator").to.equal("0")
        expect(state[4].toString(), "totalExitNodeOpearator").to.equal("0")
    })

    it('Fail to remove operator', async function () {
        // add a new node operator
        await newValidator(1, user1Address)

        // get a node operator
        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        // unstake a node operator
        await nodeOperatorRegistryContract.connect(user1).unstake()

        // unstakeClaim a node operator
        await nodeOperatorRegistryContract.connect(user1).unstakeClaim()

        // claim fees
        await nodeOperatorRegistryContract.connect(user1)
            .claimFee(1, 1, ethers.utils.randomBytes(64))

        // revert remove node operator.
        await expect(nodeOperatorRegistryContract.connect(user1).removeOperator(1))
            .to.revertedWith("Permission not found")

        // revert remove node operator that not exists.
        await expect(nodeOperatorRegistryContract.removeOperator(2))
            .to.revertedWith("Node Operator state not exit")
    })

    it('Success set stake amount and fees', async function () {
        await nodeOperatorRegistryContract.setStakeAmountAndFees(
            toEth("100"),
            toEth("100"),
            toEth("30"),
            toEth("30"),
        )
        const state = await nodeOperatorRegistryContract.getState()
        expect(state[9], "maxAmountStake").to.equal(toEth("100"))
        expect(state[10], "minAmountStake").to.equal(toEth("100"))
        expect(state[11], "maxHeimdallFees").to.equal(toEth("30"))
        expect(state[12], "minHeimdallFees").to.equal(toEth("30"))
    })

    it('Fail to set stake amount and fees', async function () {
        // revert mac amount less than the min amount    
        await expect(nodeOperatorRegistryContract.setStakeAmountAndFees(
            toEth("100"),
            toEth("50"),
            toEth("30"),
            toEth("30"),
        )).to.revertedWith("Invalid amount")

        // revert mac amount less than the min amount    
        await expect(nodeOperatorRegistryContract.setStakeAmountAndFees(
            toEth("100"),
            toEth("100"),
            toEth("30"),
            toEth("10"),
        )).to.revertedWith("Invalid heimdallFees")
    })

    it('upgrade contract', async function () {
        await newValidator(1, user1Address)
        await newValidator(2, user2Address)

        // get a node operator
        let no = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        await nodeOperatorRegistryContract.setStakeAmountAndFees(
            toEth("100"),
            toEth("100"),
            toEth("30"),
            toEth("30"),
        )

        // check the actual contract version should be 1.0.0
        expect(await nodeOperatorRegistryContract.version() === '1.0.0')

        // upgrade the contract to v2
        const NodeOperatorRegistryV2Artifact = await ethers.getContractFactory('NodeOperatorRegistryV2')
        await upgrades.upgradeProxy(nodeOperatorRegistryContract.address, NodeOperatorRegistryV2Artifact)

        // check the actual contract version should be 2.0.0
        expect(await nodeOperatorRegistryContract.version() === '2.0.0')

        // check node operator state v1.0.0 is maintained
        const state = await nodeOperatorRegistryContract.getState();
        expect(state[0].toString(), "totalNodeOpearator").to.equal("2")
        expect(state[1].toString(), "totalActiveNodeOpearator").to.equal("1")
        expect(state[2].toString(), "totalStakedNodeOpearator").to.equal("1")
        expect(state[3].toString(), "totalUnstakedNodeOpearator").to.equal("0")
        expect(state[4].toString(), "totalExitNodeOpearator").to.equal("0")
        expect(state[9], "maxAmountStake").to.equal(toEth("100"))
        expect(state[10], "minAmountStake").to.equal(toEth("100"))
        expect(state[11], "maxHeimdallFees").to.equal(toEth("30"))
        expect(state[12], "minHeimdallFees").to.equal(toEth("30"))
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

    it('Success upgrade validator factory validator implementation', async function () {
        // add a new node operator
        await newValidator(1, user1Address)
        await newValidator(2, user2Address)

        // get a node operator
        let no1 = await nodeOperatorRegistryContract.getNodeOperator(1, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user1).approve(no1[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("20"))

        // get a node operator
        let no2 = await nodeOperatorRegistryContract.getNodeOperator(2, false)

        // approve token to validator contract
        await polygonERC20Contract.connect(user2).approve(no2[6], toEth("30"))

        // stake a node operator
        await nodeOperatorRegistryContract.connect(user2).stake(toEth("10"), toEth("20"))


        const validatorArtifactV2: Artifact = await hardhat.artifacts.readArtifact("ValidatorV2");
        const validatorContractV2 = await deployContract(
            signer,
            validatorArtifactV2,
            []
        )
        

        const validatorProxyArtifact: Artifact = await hardhat.artifacts.readArtifact("ValidatorProxy");
        const v = await validatorFactoryContract.getValidators()

        for (let idx = 0; idx < v.length; idx++) {

            await signer.sendTransaction({
                to: v[idx],
                data: new ethers.utils.Interface(validatorProxyArtifact.abi)
                    .encodeFunctionData("setImplementation", [validatorContractV2.address])
            })

            let res = await signer.call({
                to: v[idx],
                data: new ethers.utils.Interface(validatorArtifactV2.abi).encodeFunctionData("version")
            })
            const version = new ethers.utils.Interface(validatorArtifactV2.abi).decodeFunctionResult("version", res)
            expect(version[0], "validator version").to.equal("2.0.0")
            
            res = await signer.call({
                to: v[idx],
                data: new ethers.utils.Interface(validatorArtifactV2.abi).encodeFunctionData("getOperator")
            })
            const op = new ethers.utils.Interface(validatorArtifactV2.abi).decodeFunctionResult("getOperator", res)
            expect(op[0], "operator address").to.equal(nodeOperatorRegistryContract.address)
        }
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
        _id, name, signerPubkey, 1
    )
    return { name, signerPubkey }
}

// convert a string to ether
function toEth(amount: string): BigNumber {
    return ethers.utils.parseEther(amount)
}