import hardhat, { ethers, upgrades } from "hardhat";
import { Signer, Contract, BigNumber } from "ethers";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Artifact } from "hardhat/types";
import {
    ValidatorFactory,
    ValidatorFactory__factory,
    NodeOperatorRegistry__factory,
    NodeOperatorRegistry,
    ValidatorProxy,
    ERC721Test,
    ERC20,
    StakeManagerMock,
    ValidatorFactoryV2,
    NodeOperatorRegistryV2
} from "../typechain";

const { deployContract } = hardhat.waffle;

chai.use(solidity);

let signer: Signer;
let user1: Signer;
let user1Address: string;
let user2: Signer;
let user2Address: string;
let user3: Signer;
let user3Address: string;

let nodeOperatorRegistryContract: NodeOperatorRegistry;
let validatorFactoryContract: ValidatorFactory;
let lidoMockContract: Contract;
let polygonERC20Contract: ERC20;
let erc721Contract: ERC721Test;
let stakeManagerMockContract: StakeManagerMock;
let validatorContract: Contract;
const ZERO_ADDRESS = ethers.constants.AddressZero;

describe("NodeOperator", function () {
    beforeEach(async function () {
        const accounts = await ethers.getSigners();
        signer = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];
        user1Address = await user1.getAddress();
        user2Address = await user2.getAddress();
        user3Address = await user3.getAddress();

        // deploy ERC20 token
        const polygonERC20Artifact: Artifact = await hardhat.artifacts.readArtifact("Polygon");
        polygonERC20Contract = (await deployContract(signer, polygonERC20Artifact)) as ERC20;

        // deploy ERC721 token
        const polygonERC721Artifact: Artifact = await hardhat.artifacts.readArtifact("ERC721Test");
        erc721Contract = (await deployContract(signer, polygonERC721Artifact)) as ERC721Test;

        // deploy stake manager mock
        const stakeManagerMockArtifact: Artifact = await hardhat.artifacts.readArtifact("StakeManagerMock");
        stakeManagerMockContract = (await deployContract(
            signer,
            stakeManagerMockArtifact,
            [polygonERC20Contract.address, erc721Contract.address]
        )) as StakeManagerMock;
        const validatorArtifact: Artifact = await hardhat.artifacts.readArtifact("Validator");
        validatorContract = await deployContract(
            signer,
            validatorArtifact,
            []
        );

        // deploy validator factory
        const validatorFactoryArtifact: ValidatorFactory__factory = (
            await ethers.getContractFactory("ValidatorFactory")
        ) as ValidatorFactory__factory;
        validatorFactoryContract = (
            await upgrades.deployProxy(
                validatorFactoryArtifact, [validatorContract.address])) as ValidatorFactory;

        // deploy node operator contract
        const nodeOperatorRegistryArtifact = (
            await ethers.getContractFactory("NodeOperatorRegistry")
        ) as NodeOperatorRegistry__factory;
        nodeOperatorRegistryContract = (
            await upgrades.deployProxy(
                nodeOperatorRegistryArtifact,
                [
                    validatorFactoryContract.address,
                    stakeManagerMockContract.address,
                    polygonERC20Contract.address
                ]

            )) as NodeOperatorRegistry;

        // deploy lido mock contract
        // TODO: change later with the real lido contract.
        const lidoMockArtifact: Artifact = await hardhat.artifacts.readArtifact("LidoMock");
        lidoMockContract = await deployContract(signer, lidoMockArtifact);

        await validatorFactoryContract.setOperator(nodeOperatorRegistryContract.address);
        await nodeOperatorRegistryContract.setLido(lidoMockContract.address);
        await lidoMockContract.setOperator(nodeOperatorRegistryContract.address);

        // transfer some funds to the stake manager, so we can use it to withdraw rewards.
        await polygonERC20Contract.transfer(
            stakeManagerMockContract.address,
            ethers.utils.parseEther("10000")
        );

        await polygonERC20Contract.transfer(user1Address, toEth("1000"));
        await polygonERC20Contract.transfer(user2Address, toEth("1000"));
        await polygonERC20Contract.transfer(user3Address, toEth("1000"));
    });
    describe("Node Operator", async function () {
        it("Success add new operator", async function () {
            const op1 = await newOperator(1, user1Address);
            const name1 = op1.name;
            const signerPubkey1 = op1.signerPubkey;

            const op2 = await newOperator(2, user2Address);
            const name2 = op2.name;
            const signerPubkey2 = op2.signerPubkey;

            // check node operator status
            await checkStats(2, 2, 0, 0, 0, 0, 0);

            // get all validator proxies from the factory.
            const validatorProxies = await validatorFactoryContract.getValidators();
            // check if the operator 1 data is correct
            await checkOperator(1, {
                status: 0,
                name: name1,
                rewardAddress: user1Address,
                validatorId: BigNumber.from(0),
                signerPubkey: signerPubkey1,
                validatorShare: ZERO_ADDRESS,
                validatorProxy: validatorProxies[0],
                commissionRate: BigNumber.from(0),
                slashed: BigNumber.from(0),
                slashedTimestamp: BigNumber.from(0),
                statusUpdatedTimestamp: BigNumber.from(0),
                maxDelegateLimit: BigNumber.from(toEth("10"))
            });

            // check if the operator 2 data is correct
            await checkOperator(2, {
                status: 0,
                name: name2,
                rewardAddress: user2Address,
                validatorId: BigNumber.from(0),
                signerPubkey: signerPubkey2,
                validatorShare: ZERO_ADDRESS,
                validatorProxy: validatorProxies[1],
                commissionRate: BigNumber.from(0),
                slashed: BigNumber.from(0),
                slashedTimestamp: BigNumber.from(0),
                statusUpdatedTimestamp: BigNumber.from(0),
                maxDelegateLimit: BigNumber.from(toEth("10"))
            });
        });

        it("Fail to add new operator", async function () {
            const { name, signerPubkey } = getValidatorFakeData();

            // revert the caller has no permission.
            await expect(nodeOperatorRegistryContract.connect(user1).addOperator(
                name,
                user1Address,
                signerPubkey
            )).to.revertedWith("Permission not found");

            // revert signer pubkey not valid should be 64.
            await expect(nodeOperatorRegistryContract.addOperator(
                name,
                user1Address,
                ethers.utils.hexZeroPad("0x0", 32)
            )).to.revertedWith("Invalid Public Key");

            // revert reward address is zero.
            await expect(nodeOperatorRegistryContract.addOperator(
                name,
                ethers.constants.AddressZero,
                signerPubkey
            )).to.revertedWith("Invalid reward address");

            // add operator
            await newOperator(1, user1Address);

            // revert user try to add another operator with the same reward address
            await expect(nodeOperatorRegistryContract.addOperator(
                name,
                user1Address,
                signerPubkey
            )).to.revertedWith("Address already used");
        });

        it("Success stake an operator", async function () {
            // add a new node operator
            await newOperator(1, user1Address);
            await newOperator(2, user2Address);

            // get node operator
            const no1 = await nodeOperatorRegistryContract["getNodeOperator(uint256)"].call(this, 1);
            const no2 = await nodeOperatorRegistryContract["getNodeOperator(uint256)"].call(this, 2);

            // approve token to validator contract
            await polygonERC20Contract.connect(user1).approve(no1.validatorProxy, toEth("100"));
            await polygonERC20Contract.connect(user2).approve(no2.validatorProxy, toEth("100"));

            // stake a node operator
            expect(await nodeOperatorRegistryContract.connect(user1)
                .stake(toEth("80"), toEth("20")))
                .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(1, toEth("80"), toEth("20"));

            expect(await nodeOperatorRegistryContract.connect(user2)
                .stake(toEth("50"), toEth("50")))
                .to.emit(nodeOperatorRegistryContract, "StakeOperator").withArgs(2, toEth("50"), toEth("50"));

            await checkOperator(1, {
                status: 1,
                validatorId: BigNumber.from(1)
            });
            expect(no1.validatorProxy).not.equal(ZERO_ADDRESS);

            await checkOperator(2, {
                status: 1,
                validatorId: BigNumber.from(2)
            });
            expect(no2.validatorProxy).not.equal(ZERO_ADDRESS);

            // check global state
            await checkStats(2, 0, 2, 0, 0, 0, 0);
        });

        it("Fail to stake an operator", async function () {
            // add a new node operator
            await newOperator(1, user1Address);

            // revert the amount and heimdall fees are zero.
            await expect(nodeOperatorRegistryContract.connect(user1).stake(toEth("0"), toEth("20")))
                .to.revertedWith("Invalid amount");

            // revert the amount and heimdall fees are zero.
            await expect(nodeOperatorRegistryContract.connect(user1).stake(toEth("10"), toEth("0")))
                .to.revertedWith("Invalid heimdallFee");

            // revert the caller isn't the owner(owner is user1 and here the signer is the caller).
            await expect(nodeOperatorRegistryContract
                .stake(toEth("10"), toEth("20")))
                .to.revertedWith("The Operator doesn't exist");

            // get node operator
            const no = await nodeOperatorRegistryContract["getNodeOperator(uint256)"].call(this, 1);

            // approve token to validator contract
            await polygonERC20Contract.connect(user1).approve(no[6], toEth("30"));

            // stake a node operator
            expect(await nodeOperatorRegistryContract.connect(user1)
                .stake(toEth("10"), toEth("20")));

            // revert try to stake the same operator 2 times
            await expect(nodeOperatorRegistryContract.connect(user1)
                .stake(toEth("10"), toEth("20")))
                .to.revertedWith("The Operator status isn't INACTIVE");
        });

        it("success stop an operator", async function () {
            await newOperator(1, user1Address);
            expect(await nodeOperatorRegistryContract.stopOperator(1))
                .to.emit(nodeOperatorRegistryContract, "StopOperator").withArgs(1);

            await checkOperator(1, { status: 5 });

            // check global state
            await checkStats(1, 0, 0, 0, 0, 0, 1);

            await stakeOperator(2, user2, user2Address, "10", "20");
            expect(await nodeOperatorRegistryContract.stopOperator(2))
                .to.emit(nodeOperatorRegistryContract, "StopOperator").withArgs(2);

            await checkOperator(2, { status: 2 });

            // check global state
            await checkStats(2, 0, 0, 1, 0, 0, 1);
        });

        it("Fail stop an operator", async function () {
            // revert invalid operator id
            await expect(nodeOperatorRegistryContract.stopOperator(10))
                .revertedWith("The Operator doesn't exist");

            // add + stake an operator
            await stakeOperator(1, user1, user1Address, "10", "20");

            // success stop first time
            await nodeOperatorRegistryContract.stopOperator(1);

            // revert stop second time
            await expect(nodeOperatorRegistryContract.stopOperator(1))
                .to.revertedWith("The Operator status isn't ACTIVE");
        });

        it("Success join an operator", async function () {
            await polygonERC20Contract.approve(stakeManagerMockContract.address, toEth("30"));
            await stakeManagerMockContract.stakeFor(
                user1Address,
                toEth("10"),
                toEth("20"),
                true,
                ethers.utils.hexZeroPad("0x01", 64)
            );

            await newOperator(1, user1Address);
            await erc721Contract.mint(user1Address, 1);

            const vp = await nodeOperatorRegistryContract.connect(user1)
                .getOwnerValidatorProxy();
            await erc721Contract.connect(user1).approve(vp, 1);

            expect(await nodeOperatorRegistryContract.connect(user1).joinOperator())
                .to.emit(nodeOperatorRegistryContract, "JoinOperator").withArgs(1);

            expect(await erc721Contract.ownerOf(1)).equal(vp);

            await checkOperator(1, {
                status: 1,
                validatorId: BigNumber.from(1),
                validatorProxy: vp
            });

            const no = await nodeOperatorRegistryContract["getNodeOperator(uint256)"].call(this, 1);
            expect(no.validatorShare).not.equal(ZERO_ADDRESS);

            await checkStats(1, 0, 1, 0, 0, 0, 0);
        });

        it("Fail join an operator", async function () {
            // revert invalid operator id
            await expect(nodeOperatorRegistryContract.joinOperator())
                .revertedWith("The Operator doesn't exist");

            await stakeOperator(1, user1, user1Address, "10", "20");

            await expect(nodeOperatorRegistryContract.connect(user1).joinOperator())
                .revertedWith("The Operator status isn't INACTIVE");

            await newOperator(2, user2Address);
            await expect(nodeOperatorRegistryContract.connect(user2).joinOperator())
                .revertedWith("Validator id equal to ZERO");
        });

        it("Success restake an operator", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            // set restake to true
            await nodeOperatorRegistryContract.setRestake(true);

            // get node operators
            const no1 = await nodeOperatorRegistryContract["getNodeOperator(uint256)"].call(this, 1);
            const no2 = await nodeOperatorRegistryContract["getNodeOperator(uint256)"].call(this, 2);

            // approve token to validator contract
            await polygonERC20Contract.connect(user1).approve(no1.validatorProxy, toEth("50"));
            await polygonERC20Contract.connect(user2).approve(no2.validatorProxy, toEth("100"));

            // restake a node operator
            expect(await nodeOperatorRegistryContract.connect(user1)
                .restake(toEth("50"), true))
                .to.emit(nodeOperatorRegistryContract, "RestakeOperator").withArgs(1, toEth("50"), true);

            // restake a node operator
            expect(await nodeOperatorRegistryContract.connect(user2)
                .restake(toEth("100"), false))
                .to.emit(nodeOperatorRegistryContract, "RestakeOperator").withArgs(2, toEth("100"), false);

            await checkStats(2, 0, 2, 0, 0, 0, 0);
        });

        it("Fail restake an operator", async function () {
            // add a new node operator
            await newOperator(1, user1Address);

            // revert restake isn't enabled by the DAO
            await expect(nodeOperatorRegistryContract.connect(user1)
                .restake(toEth("0"), true)).to.revertedWith("Restake is disabled");

            // set restake to true
            await nodeOperatorRegistryContract.setRestake(true);

            // revert amount = 0 and restake rewards is false
            await expect(nodeOperatorRegistryContract.connect(user1)
                .restake(toEth("0"), false)).to.revertedWith("Amount is ZERO");

            // revert user2 has no operator
            await expect(nodeOperatorRegistryContract.connect(user2)
                .restake(toEth("10"), false)).to.revertedWith("The Operator doesn't exist");

            // revert operator not active
            await expect(nodeOperatorRegistryContract.connect(user1)
                .restake(toEth("10"), false)).to.revertedWith("The operator status isn't ACTIVE");
        });

        it("Success unstake an operator", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            // unstake a node operator
            expect(await nodeOperatorRegistryContract.connect(user1).unstake())
                .to.emit(nodeOperatorRegistryContract, "UnstakeOperator").withArgs(1);

            await checkOperator(1, { status: 3 });
            await checkStats(2, 0, 1, 0, 1, 0, 0);
        });

        it("Fail to unstake an operator", async function () {
            // revert caller try to unstake a operator that not exist.
            await expect(nodeOperatorRegistryContract.connect(user1).unstake())
                .to.revertedWith("The Operator doesn't exist");

            // add a new node operator.
            await newOperator(1, user1Address);

            // revert caller try to unstake a operator that has not yet staked
            await expect(nodeOperatorRegistryContract.connect(user1).unstake())
                .to.revertedWith("The operator status isn't ACTIVE");

            // stake an operator.
            await stakeOperator(2, user2, user2Address, "10", "20");

            // unstake
            await nodeOperatorRegistryContract.connect(user2).unstake();

            // revert try to unstake a second time.
            await expect(nodeOperatorRegistryContract.connect(user2).unstake())
                .to.revertedWith("The operator status isn't ACTIVE");
        });

        it("Success migrate NFT to new owner", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await nodeOperatorRegistryContract.stopOperator(1);

            const vp = await nodeOperatorRegistryContract.connect(user1).getOwnerValidatorProxy();
            await erc721Contract.mint(vp, 1);

            expect(await nodeOperatorRegistryContract.connect(user1).migrate())
                .to.emit(nodeOperatorRegistryContract, "MigrateOperator")
                .withArgs(1, user1Address);

            await checkOperator(1, { status: 5 });
            await checkStats(2, 0, 1, 0, 0, 0, 1);
        });

        it("Fail migrate NFT to new owner", async function () {
            // revert caller try to unstake a operator that not exist.
            await expect(nodeOperatorRegistryContract.connect(user1).migrate())
                .to.revertedWith("The Operator doesn't exist");

            // add a new node operator.
            await stakeOperator(1, user1, user1Address, "10", "20");

            // revert caller try to unstake a operator that has not yet staked
            await expect(nodeOperatorRegistryContract.connect(user1).migrate())
                .to.revertedWith("The Operator status isn't STOPPED");

            const vp = await nodeOperatorRegistryContract.connect(user1).getOwnerValidatorProxy();
            await erc721Contract.mint(vp, 1);
            await nodeOperatorRegistryContract.stopOperator(1);

            // revert caller try to unstake a operator that has not yet staked
            await nodeOperatorRegistryContract.connect(user1).migrate();

            // revert caller try to unstake a operator that has not yet staked
            await expect(nodeOperatorRegistryContract.connect(user1).migrate())
                .to.revertedWith("The Operator status isn't STOPPED");
        });

        it("Success to unjail an operator", async function () {
            // set unjail to true
            await nodeOperatorRegistryContract.setUnjail(true);

            await stakeOperator(1, user1, user1Address, "10", "20");
            await nodeOperatorRegistryContract.connect(user1).unstake();

            expect(await nodeOperatorRegistryContract.connect(user1).unjail())
                .to.emit(nodeOperatorRegistryContract, "Unjail").withArgs(1);

            await checkOperator(1, { status: 1 });
            await checkStats(1, 0, 1, 0, 0, 0, 0);
        });

        it("Fail to unjail an operator", async function () {
            // add operator
            await newOperator(1, user1Address);

            // revert unjail is disabled
            await expect(nodeOperatorRegistryContract.connect(user1).unjail())
                .revertedWith("Unjail is disabled");

            // set unjail to true
            await nodeOperatorRegistryContract.setUnjail(true);

            // revert user2 try to unjail
            await expect(nodeOperatorRegistryContract.connect(user2).unjail())
                .revertedWith("The Operator doesn't exist");

            // user2 stake his operator
            await stakeOperator(2, user2, user2Address, "10", "20");

            // revert user2 try to unjail
            await expect(nodeOperatorRegistryContract.connect(user2).unjail())
                .revertedWith("The Operator status isn't UNSTAKED");

            await nodeOperatorRegistryContract.connect(user2).unstake();

            // unjail the operator
            await nodeOperatorRegistryContract.connect(user2).unjail();

            // revert try to unjail second time
            await expect(nodeOperatorRegistryContract.connect(user2).unjail())
                .revertedWith("The Operator status isn't UNSTAKED");
        });

        it("Success to topUpFee", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            const no1 = await nodeOperatorRegistryContract["getNodeOperator(uint256)"].call(this, 1);
            const no2 = await nodeOperatorRegistryContract["getNodeOperator(uint256)"].call(this, 2);

            // approve token to validator proxy
            await polygonERC20Contract.connect(user1).approve(no1.validatorProxy, toEth("50"));
            await polygonERC20Contract.connect(user2).approve(no2.validatorProxy, toEth("100"));

            expect(await nodeOperatorRegistryContract.connect(user1)
                .topUpForFee(toEth("50")))
                .to.emit(nodeOperatorRegistryContract, "TopUpHeimdallFees")
                .withArgs(1, toEth("50"));

            expect(await nodeOperatorRegistryContract.connect(user2)
                .topUpForFee(toEth("100")))
                .to.emit(nodeOperatorRegistryContract, "TopUpHeimdallFees")
                .withArgs(2, toEth("100"));
        });

        it("Fail to topUpFee", async function () {
            // revert the caller has no node operator.
            await expect(nodeOperatorRegistryContract.connect(user1)
                .topUpForFee(toEth("20")))
                .to.revertedWith("The Operator doesn't exist");

            await newOperator(1, user1Address);

            // revert heimdall fees = 0
            await expect(nodeOperatorRegistryContract.connect(user1).topUpForFee(0))
                .to.revertedWith("Invalid heimdallFee");

            // revert topup on a no staked operator
            await expect(nodeOperatorRegistryContract.connect(user1).topUpForFee(toEth("20")))
                .to.revertedWith("The operator status isn't ACTIVE");
        });

        it("Success unstake claim", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await nodeOperatorRegistryContract.connect(user1).unstake();
            await nodeOperatorRegistryContract.connect(user2).unstake();

            const beforeBalance1 = await polygonERC20Contract.balanceOf(user1Address);
            const beforeBalance2 = await polygonERC20Contract.balanceOf(user2Address);

            expect(
                await nodeOperatorRegistryContract.connect(user1).unstakeClaim()
            ).to.emit(nodeOperatorRegistryContract, "UnstakeClaim");

            expect(
                await nodeOperatorRegistryContract.connect(user2).unstakeClaim()
            ).to.emit(nodeOperatorRegistryContract, "UnstakeClaim");

            const afterBalance1 = await polygonERC20Contract.balanceOf(user1Address);
            const afterBalance2 = await polygonERC20Contract.balanceOf(user2Address);
            expect(beforeBalance1.toString(), "beforeBalance").not.equal(afterBalance1.toString());
            expect(beforeBalance2.toString(), "beforeBalance").not.equal(afterBalance2.toString());

            await checkOperator(1, { status: 4 });
            await checkOperator(2, { status: 4 });
            await checkStats(2, 0, 0, 0, 0, 2, 0);
        });

        it("Fail unstake claim", async function () {
            // revert the caller has no node operator.
            await expect(nodeOperatorRegistryContract.connect(user1)
                .unstakeClaim())
                .to.revertedWith("The Operator doesn't exist");

            await newOperator(1, user1Address);

            // revert the operator isn't in unstaked state.
            await expect(nodeOperatorRegistryContract.connect(user1)
                .unstakeClaim())
                .to.revertedWith("The Operator status isn't UNSTAKED");

            await stakeOperator(2, user2, user2Address, "10", "20");
            await nodeOperatorRegistryContract.connect(user2).unstake();

            // revert the operator isn't in unstaked state.
            await nodeOperatorRegistryContract.connect(user2).unstakeClaim();

            // revert try to claim 2 times.
            await expect(nodeOperatorRegistryContract.connect(user2)
                .unstakeClaim())
                .to.revertedWith("The Operator status isn't UNSTAKED");
        });

        it("Success claim heimdall fees", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await nodeOperatorRegistryContract.connect(user1).unstake();
            await nodeOperatorRegistryContract.connect(user2).unstake();
            await nodeOperatorRegistryContract.connect(user1).unstakeClaim();
            await nodeOperatorRegistryContract.connect(user2).unstakeClaim();

            await nodeOperatorRegistryContract.connect(user1)
                .claimFee(1, 1, ethers.utils.randomBytes(64));

            await nodeOperatorRegistryContract.connect(user2)
                .claimFee(1, 1, ethers.utils.randomBytes(64));

            await checkOperator(1, { status: 5 });
            await checkOperator(2, { status: 5 });

            await checkStats(2, 0, 0, 0, 0, 0, 2);
        });

        it("Fail claim heimdall fees", async function () {
            await expect(nodeOperatorRegistryContract.connect(user2)
                .claimFee(1, 1, ethers.utils.randomBytes(64)))
                .to.revertedWith("The Operator doesn't exist");

            // add a new node operator
            await newOperator(1, user1Address);

            // revert claim fees before unstake claim
            await expect(nodeOperatorRegistryContract.connect(user1)
                .claimFee(1, 1, ethers.utils.randomBytes(64)))
                .to.revertedWith("The Operator status isn't CLAIMED");

            await stakeOperator(2, user2, user2Address, "10", "20");
            await nodeOperatorRegistryContract.connect(user2).unstake();
            await nodeOperatorRegistryContract.connect(user2).unstakeClaim();
            await nodeOperatorRegistryContract.connect(user2)
                .claimFee(1, 1, ethers.utils.randomBytes(64));

            // revert try to claim 2 times
            await expect(nodeOperatorRegistryContract.connect(user1)
                .claimFee(1, 1, ethers.utils.randomBytes(64)))
                .to.revertedWith("The Operator status isn't CLAIMED");
        });

        it("Success withdraw validator rewards", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            // simulate rewards on stake manager
            await polygonERC20Contract.transfer(stakeManagerMockContract.address, toEth("200"));

            // get users balance before request withdraw rewards
            const b1 = await polygonERC20Contract.balanceOf(user1Address);
            const b2 = await polygonERC20Contract.balanceOf(user2Address);

            // users request withdraw rewards
            expect(await nodeOperatorRegistryContract.connect(user1).withdrawRewards())
                .to.emit(nodeOperatorRegistryContract, "WithdrawRewards");
            expect(await nodeOperatorRegistryContract.connect(user2).withdrawRewards())
                .to.emit(nodeOperatorRegistryContract, "WithdrawRewards");
            // get users balance before request withdraw rewards
            const a1 = await polygonERC20Contract.balanceOf(user1Address);
            const a2 = await polygonERC20Contract.balanceOf(user2Address);

            expect(b1, "balance user1").not.eq(a1);
            expect(b2, "balance user2").not.eq(a2);
        });

        it("Fail withdraw validator rewards", async function () {
            // revert operator not exists
            await expect(nodeOperatorRegistryContract.withdrawRewards())
                .to.revertedWith("The Operator doesn't exist");

            // add operator
            await newOperator(1, user1Address);

            // revert withdraw rewards before stake
            await expect(nodeOperatorRegistryContract.connect(user1).withdrawRewards())
                .to.revertedWith("The Operator status isn't ACTIVE");
        });

        it("Success update signer publickey", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");

            const newSignPubkey = ethers.utils.hexZeroPad("0x02", 64);
            expect(await nodeOperatorRegistryContract.connect(user1)
                .updateSigner(newSignPubkey))
                .to.emit(nodeOperatorRegistryContract, "UpdateSignerPubkey")
                .withArgs(1, newSignPubkey);
            await checkOperator(1, { signerPubkey: newSignPubkey });

            await newOperator(2, user2Address);

            expect(await nodeOperatorRegistryContract.connect(user2)
                .updateSigner(newSignPubkey))
                .to.emit(nodeOperatorRegistryContract, "UpdateSignerPubkey")
                .withArgs(2, newSignPubkey);
            await checkOperator(2, { signerPubkey: newSignPubkey });
        });

        it("Fail update signer publickey", async function () {
            const newSignPubkey = ethers.utils.hexZeroPad("0x02", 64);
            // revert operator not exists
            await expect(nodeOperatorRegistryContract.connect(user1)
                .updateSigner(newSignPubkey))
                .to.revertedWith("The Operator doesn't exist");

            await stakeOperator(1, user1, user1Address, "10", "20");
            await nodeOperatorRegistryContract.connect(user1).unstake();

            await expect(nodeOperatorRegistryContract.connect(user1)
                .updateSigner(newSignPubkey))
                .to.revertedWith("The Operator status isn't ACTIVE");
        });

        it("Success set operator name", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            const newName = "super node";
            expect(await nodeOperatorRegistryContract.connect(user1)
                .setOperatorName(newName))
                .to.emit(nodeOperatorRegistryContract, "NewName").withArgs(1, newName);
            await checkOperator(1, { name: newName });

            await newOperator(2, user2Address);
            expect(await nodeOperatorRegistryContract.connect(user2)
                .setOperatorName(newName))
                .to.emit(nodeOperatorRegistryContract, "NewName").withArgs(2, newName);
            await checkOperator(2, { name: newName });
        });

        it("Fail set operator name", async function () {
            const newName = "super node";
            await expect(nodeOperatorRegistryContract.connect(user1).setOperatorName(newName))
                .to.revertedWith("The Operator doesn't exist");
        });

        it("Success set operator reward address", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");

            // change rewardAddress from user1 to user2
            expect(await nodeOperatorRegistryContract.connect(user1)
                .setOperatorRewardAddress(user2Address))
                .to.emit(nodeOperatorRegistryContract, "NewRewardAddress")
                .withArgs(1, user2Address);
            await checkOperator(1, { rewardAddress: user2Address });

            // the new owner tries to update the name
            const newName = "super node";
            expect(await nodeOperatorRegistryContract.connect(user2)
                .setOperatorName(newName))
                .to.emit(nodeOperatorRegistryContract, "NewName")
                .withArgs(1, newName);
            await checkOperator(1, { name: newName });
        });

        it("Fail set operator reward address", async function () {
            await expect(nodeOperatorRegistryContract.connect(user1)
                .setOperatorRewardAddress(user2Address))
                .to.revertedWith("The Operator doesn't exist");

            await stakeOperator(1, user1, user1Address, "10", "20");
            await expect(nodeOperatorRegistryContract.connect(user1)
                .setOperatorRewardAddress(user1Address))
                .to.revertedWith("Address already used");
        });

        it("Success remove node operator", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await newOperator(3, user3Address);
            await checkStats(3, 1, 2, 0, 0, 0, 0);

            const vp = await nodeOperatorRegistryContract.connect(user2).getOwnerValidatorProxy();
            await erc721Contract.mint(vp, 2);

            await nodeOperatorRegistryContract.connect(user1).unstake();
            await checkStats(3, 1, 1, 0, 1, 0, 0);

            await nodeOperatorRegistryContract.stopOperator(2);
            await checkStats(3, 1, 0, 1, 1, 0, 0);

            await nodeOperatorRegistryContract.stopOperator(3);
            await checkStats(3, 0, 0, 1, 1, 0, 1);

            await nodeOperatorRegistryContract.connect(user1).unstakeClaim();
            await checkStats(3, 0, 0, 1, 0, 1, 1);

            await nodeOperatorRegistryContract.connect(user2).migrate();
            await checkStats(3, 0, 0, 0, 0, 1, 2);

            await nodeOperatorRegistryContract.connect(user1).claimFee(
                1, 1, ethers.utils.randomBytes(64)
            );

            await checkStats(3, 0, 0, 0, 0, 0, 3);

            expect(await nodeOperatorRegistryContract.removeOperator(1))
                .to.emit(nodeOperatorRegistryContract, "RemoveOperator").withArgs(1);
            expect(await nodeOperatorRegistryContract.removeOperator(2))
                .to.emit(nodeOperatorRegistryContract, "RemoveOperator").withArgs(2);
            expect(await nodeOperatorRegistryContract.removeOperator(3))
                .to.emit(nodeOperatorRegistryContract, "RemoveOperator").withArgs(3);

            await checkStats(0, 0, 0, 0, 0, 0, 0);
            expect(
                (await validatorFactoryContract.getValidators()
                ).length, "Total validator proxies").equal(0);
            expect(
                (await nodeOperatorRegistryContract.getOperatorIds()
                ).length, "Total operator ids").equal(0);
        });

        it("Fail to remove operator", async function () {
            await newOperator(1, user1Address);
            await stakeOperator(2, user2, user2Address, "10", "20");

            await nodeOperatorRegistryContract.stopOperator(1);

            // revert remove node operator.
            await expect(nodeOperatorRegistryContract.connect(user1).removeOperator(1))
                .to.revertedWith("Permission not found");

            // revert remove node operator that not exists.
            await expect(nodeOperatorRegistryContract.removeOperator(2))
                .to.revertedWith("The Operator status isn't EXIT");
        });

        describe("DAO", async function () {
            it("Success setSlashingDelay", async function () {
                const slashingDelay = 80;
                await nodeOperatorRegistryContract.setSlashingDelay(BigNumber.from(slashingDelay));
                expect(await nodeOperatorRegistryContract.slashingDelay()).eq(slashingDelay);
            });

            it("Fail setSlashingDelay", async function () {
                const slashingDelay = 80;
                await expect(
                    nodeOperatorRegistryContract.connect(user1)
                        .setSlashingDelay(BigNumber.from(slashingDelay))
                ).revertedWith("Permission not found");
            });

            it("Success setCommissionRate", async function () {
                const commission = 80;
                await nodeOperatorRegistryContract.setCommissionRate(BigNumber.from(commission));
                expect(await nodeOperatorRegistryContract.commissionRate()).eq(commission);
            });

            it("Fail setCommissionRate", async function () {
                const commission = 80;
                await expect(
                    nodeOperatorRegistryContract.connect(user1)
                        .setCommissionRate(BigNumber.from(commission))
                ).revertedWith("Permission not found");
            });

            it("Success setCommissionRate", async function () {
                const commission = 80;
                await nodeOperatorRegistryContract.setCommissionRate(BigNumber.from(commission));
                expect(await nodeOperatorRegistryContract.commissionRate()).eq(commission);
            });

            it("Fail setCommissionRate", async function () {
                const commission = 80;
                await expect(
                    nodeOperatorRegistryContract.connect(user1)
                        .setCommissionRate(BigNumber.from(commission))
                ).revertedWith("Permission not found");
            });

            it("Success updateOperatorCommissionRate", async function () {
                await newOperator(1, user1Address);
                const commission = BigNumber.from(10);
                expect(await nodeOperatorRegistryContract.updateOperatorCommissionRate(
                    1,
                    commission
                ))
                    .to.emit(nodeOperatorRegistryContract, "UpdateCommissionRate")
                    .withArgs(1, commission);

                await checkOperator(1, { commissionRate: commission });
            });

            it("Fail updateOperatorCommissionRate", async function () {
                const commission = BigNumber.from(10);
                await expect(nodeOperatorRegistryContract.updateOperatorCommissionRate(
                    1,
                    commission
                )).revertedWith("The Operator status not ACTIVE or reward address not valid");

                await stakeOperator(1, user1, user1Address, "10", "20");

                await expect(nodeOperatorRegistryContract.connect(user1).updateOperatorCommissionRate(
                    1,
                    commission
                )).revertedWith("Permission not found");
            });

            it("Success setStakeAmountAndFees", async function () {
                await newOperator(1, user1Address);
                const minAmountStake = BigNumber.from(toEth("10"));
                const minHeimdallFees = BigNumber.from(toEth("100"));
                await nodeOperatorRegistryContract.setStakeAmountAndFees(
                    minAmountStake,
                    minHeimdallFees
                );

                expect(await nodeOperatorRegistryContract.minAmountStake()).eq(minAmountStake);
                expect(await nodeOperatorRegistryContract.minHeimdallFees()).eq(minHeimdallFees);
            });

            it("Fail setStakeAmountAndFees", async function () {
                const minAmountStake = BigNumber.from(10);
                const minHeimdallFees = BigNumber.from(100);
                await expect(nodeOperatorRegistryContract.connect(user1)
                    .setStakeAmountAndFees(
                        minAmountStake,
                        minHeimdallFees
                    )).revertedWith("Permission not found");
            });

            it("Success pause unpasue", async function () {
                await nodeOperatorRegistryContract.pause();
                await expect(newOperator(1, user1Address)).revertedWith("Pausable: paused");
                await nodeOperatorRegistryContract.unpause();
                await newOperator(1, user1Address);
            });

            it("Fail pause unpasue", async function () {
                await expect(nodeOperatorRegistryContract.connect(user1).pause())
                    .revertedWith("Permission not found");
                await expect(nodeOperatorRegistryContract.connect(user1).unpause())
                    .revertedWith("Permission not found");
            });

            it("Success DAO setter", async function () {
                const address = "0x0000000000000000000000000000000000000010";
                const version = "1.11.0";
                await nodeOperatorRegistryContract.setLido(address);
                await nodeOperatorRegistryContract.setValidatorFactory(address);
                await nodeOperatorRegistryContract.setStakeManager(address);
                await nodeOperatorRegistryContract.setVersion(version);
                await nodeOperatorRegistryContract.setRestake(true);
                await nodeOperatorRegistryContract.setUnjail(true);

                expect(await nodeOperatorRegistryContract.getLido()).eq(address);
                expect(await nodeOperatorRegistryContract.getValidatorFactory()).eq(address);
                expect(await nodeOperatorRegistryContract.getStakeManager()).eq(address);

                expect(await nodeOperatorRegistryContract.allowsUnjail()).true;
                expect(await nodeOperatorRegistryContract.allowsRestake()).true;
                expect(await nodeOperatorRegistryContract.version()).eq(version);
            });

            it("Fail DAO setter", async function () {
                const address = "0x0000000000000000000000000000000000000010";
                const version = "1.11.0";
                await expect(nodeOperatorRegistryContract.connect(user1).setLido(address))
                    .revertedWith("Permission not found");
                await expect(nodeOperatorRegistryContract.connect(user1).setValidatorFactory(address))
                    .revertedWith("Permission not found");
                await expect(nodeOperatorRegistryContract.connect(user1).setStakeManager(address))
                    .revertedWith("Permission not found");
                await expect(nodeOperatorRegistryContract.connect(user1).setVersion(version))
                    .revertedWith("Permission not found");
                await expect(nodeOperatorRegistryContract.connect(user1).setRestake(true))
                    .revertedWith("Permission not found");
                await expect(nodeOperatorRegistryContract.connect(user1).setUnjail(true))
                    .revertedWith("Permission not found");
            });
        });

        describe("Slash operator", async function () {
            it("List slashed operators", async function () {
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeOperator(2, user2, user2Address, "200", "35");
                await stakeOperator(3, user3, user3Address, "300", "50");

                await stakeManagerMockContract.slash(1);
                let slashedOperators = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                expect(slashedOperators.length, "slashed operators array length not valid").eq(3);

                for (let i = 0; i < slashedOperators.length; i++) {
                    if (i === 0) {
                        expect(slashedOperators[i], "Operator should be slashed").true;
                    } else {
                        expect(slashedOperators[i], "Operator should be slashed").false;
                    }
                }

                await stakeManagerMockContract.slash(2);
                await stakeManagerMockContract.slash(3);

                slashedOperators = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();

                for (let i = 0; i < slashedOperators.length; i++) {
                    expect(slashedOperators[i], i + " Operator should be slashed").true;
                }
            });

            it("success getOperatorInfos", async function () {
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeOperator(2, user2, user2Address, "100", "20");
                await stakeOperator(3, user3, user3Address, "100", "20");

                let operators = await nodeOperatorRegistryContract.getOperatorInfos(false);

                for (let i = 0; i < operators.length; i++) {
                    const op = operators[i];
                    await checkOperator(i + 1, {
                        validatorShare: op.validatorShare,
                        maxDelegateLimit: op.maxDelegateLimit,
                        rewardAddress: op.rewardAddress
                    });
                    expect(op.rewardPercentage, "rewardPercentage").eq(0);
                }

                await stakeManagerMockContract.slash(1);
                await stakeManagerMockContract.slash(3);

                const res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);
                operators = await nodeOperatorRegistryContract.getOperatorInfos(true);

                for (let i = 0; i < operators.length; i++) {
                    const op = operators[i];
                    await checkOperator(i + 1, {
                        validatorShare: op.validatorShare,
                        maxDelegateLimit: op.maxDelegateLimit,
                        rewardAddress: op.rewardAddress
                    });
                    if (i !== 1) {
                        expect(op.rewardPercentage, "rewardPercentage").eq(90);
                    } else {
                        expect(op.rewardPercentage, "rewardPercentage").eq(100);
                    }
                }
            });

            it("success slash operators and getRewardPercentage ", async function () {
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeOperator(2, user2, user2Address, "100", "20");
                await stakeOperator(3, user3, user3Address, "100", "20");

                await stakeManagerMockContract.slash(1);
                await stakeManagerMockContract.slash(2);
                await stakeManagerMockContract.slash(3);
                let res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);

                await checkOperator(1, { slashed: BigNumber.from(1) });
                await checkOperator(2, { slashed: BigNumber.from(1) });
                await checkOperator(3, { slashed: BigNumber.from(1) });

                res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);
                await checkOperator(1, { slashed: BigNumber.from(1) });
                await checkOperator(2, { slashed: BigNumber.from(1) });
                await checkOperator(3, { slashed: BigNumber.from(1) });

                res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);
                expect(await nodeOperatorRegistryContract.getRewardPercentage(user1Address)).eq(90);
                expect(await nodeOperatorRegistryContract.getRewardPercentage(user2Address)).eq(90);
                expect(await nodeOperatorRegistryContract.getRewardPercentage(user3Address)).eq(90);

                await stakeManagerMockContract.slash(1);
                await stakeManagerMockContract.slash(3);

                res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);
                await checkOperator(1, { slashed: BigNumber.from(2) });
                await checkOperator(2, { slashed: BigNumber.from(1) });
                await checkOperator(3, { slashed: BigNumber.from(2) });

                expect(await nodeOperatorRegistryContract.getRewardPercentage(user1Address)).eq(80);
                expect(await nodeOperatorRegistryContract.getRewardPercentage(user2Address)).eq(90);
                expect(await nodeOperatorRegistryContract.getRewardPercentage(user3Address)).eq(80);

                await stakeManagerMockContract.slash(1);

                res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);
                await checkOperator(1, { slashed: BigNumber.from(3) });
                await checkOperator(2, { slashed: BigNumber.from(1) });
                await checkOperator(3, { slashed: BigNumber.from(2) });

                expect(await nodeOperatorRegistryContract.getRewardPercentage(user1Address)).eq(70);
                expect(await nodeOperatorRegistryContract.getRewardPercentage(user2Address)).eq(90);
                expect(await nodeOperatorRegistryContract.getRewardPercentage(user3Address)).eq(80);
            });

            it("success getRewardPercentage after slashing period finished", async function () {
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeOperator(2, user2, user2Address, "100", "20");
                await stakeOperator(3, user3, user3Address, "100", "20");

                await stakeManagerMockContract.slash(1);
                await stakeManagerMockContract.slash(2);
                await stakeManagerMockContract.slash(3);
                let res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);

                let operators = await nodeOperatorRegistryContract.getOperatorInfos(true);

                for (let i = 0; i < operators.length; i++) {
                    const op = operators[i];
                    await checkOperator(i + 1, {
                        validatorShare: op.validatorShare,
                        maxDelegateLimit: op.maxDelegateLimit,
                        rewardAddress: op.rewardAddress
                    });
                    expect(op.rewardPercentage, "rewardPercentage").eq(90);
                }

                await ethers.provider.send("evm_increaseTime", [10000]);
                await ethers.provider.send("evm_mine", []);
                operators = await nodeOperatorRegistryContract.getOperatorInfos(true);

                for (let i = 0; i < operators.length; i++) {
                    const op = operators[i];
                    await checkOperator(i + 1, {
                        validatorShare: op.validatorShare,
                        maxDelegateLimit: op.maxDelegateLimit,
                        rewardAddress: op.rewardAddress
                    });
                    expect(op.rewardPercentage, "rewardPercentage").eq(100);
                }

                await stakeManagerMockContract.slash(1);
                await stakeManagerMockContract.slash(2);
                await stakeManagerMockContract.slash(3);
                res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);

                await stakeManagerMockContract.slash(1);
                await stakeManagerMockContract.slash(2);
                await stakeManagerMockContract.slash(3);
                res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);

                await stakeManagerMockContract.slash(1);
                await stakeManagerMockContract.slash(2);
                await stakeManagerMockContract.slash(3);
                res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);

                operators = await nodeOperatorRegistryContract.getOperatorInfos(true);
                for (let i = 0; i < operators.length; i++) {
                    const op = operators[i];
                    await checkOperator(i + 1, {
                        validatorShare: op.validatorShare,
                        maxDelegateLimit: op.maxDelegateLimit,
                        rewardAddress: op.rewardAddress
                    });
                    expect(op.rewardPercentage, "rewardPercentage").eq(70);
                }

                await ethers.provider.send("evm_increaseTime", [10000]);
                await ethers.provider.send("evm_mine", []);
                res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);

                operators = await nodeOperatorRegistryContract.getOperatorInfos(true);
                for (let i = 0; i < operators.length; i++) {
                    const op = operators[i];
                    await checkOperator(i + 1, {
                        validatorShare: op.validatorShare,
                        maxDelegateLimit: op.maxDelegateLimit,
                        rewardAddress: op.rewardAddress
                    });
                    expect(op.rewardPercentage, "rewardPercentage").eq(80);
                }

                await ethers.provider.send("evm_increaseTime", [8092]);
                await ethers.provider.send("evm_mine", []);
                res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);

                operators = await nodeOperatorRegistryContract.getOperatorInfos(true);
                for (let i = 0; i < operators.length; i++) {
                    const op = operators[i];
                    await checkOperator(i + 1, {
                        validatorShare: op.validatorShare,
                        maxDelegateLimit: op.maxDelegateLimit,
                        rewardAddress: op.rewardAddress
                    });
                    expect(op.rewardPercentage, "rewardPercentage").eq(90);
                }

                await ethers.provider.send("evm_increaseTime", [10000]);
                await ethers.provider.send("evm_mine", []);
                res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);

                operators = await nodeOperatorRegistryContract.getOperatorInfos(true);
                for (let i = 0; i < operators.length; i++) {
                    const op = operators[i];
                    await checkOperator(i + 1, {
                        validatorShare: op.validatorShare,
                        maxDelegateLimit: op.maxDelegateLimit,
                        rewardAddress: op.rewardAddress
                    });
                    expect(op.rewardPercentage, "rewardPercentage").eq(100);
                }

                await ethers.provider.send("evm_increaseTime", [10000]);
                await ethers.provider.send("evm_mine", []);
                res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);

                operators = await nodeOperatorRegistryContract.getOperatorInfos(true);
                for (let i = 0; i < operators.length; i++) {
                    const op = operators[i];
                    await checkOperator(i + 1, {
                        validatorShare: op.validatorShare,
                        maxDelegateLimit: op.maxDelegateLimit,
                        rewardAddress: op.rewardAddress
                    });
                    expect(op.rewardPercentage, "rewardPercentage").eq(100);
                }
            });

            it("restake when operator was slashed", async function () {
                await nodeOperatorRegistryContract.setRestake(true);

                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeManagerMockContract.slash(1);

                const vp = await nodeOperatorRegistryContract.connect(user1).getOwnerValidatorProxy();
                await polygonERC20Contract.connect(user1).approve(vp, toEth("100"));

                await expect(nodeOperatorRegistryContract.connect(user1).restake(toEth("100"), false))
                    .revertedWith("Could not restake the operator was slashed");

                const res = await nodeOperatorRegistryContract.getIfOperatorsWasSlashed();
                await nodeOperatorRegistryContract.slashOperators(res);
                await nodeOperatorRegistryContract.connect(user1).restake(toEth("100"), true);
            });
        });
    });

    describe("Validator proxy", async function () {
        it("check validator Proxy", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await stakeOperator(3, user3, user3Address, "10", "20");

            const users = [user1, user2, user3];

            for (let i = 0; i < users.length; i++) {
                const vp = await nodeOperatorRegistryContract.connect(users[i]).getOwnerValidatorProxy();
                const validatorProxyArtifact: Artifact = await hardhat.artifacts.readArtifact("ValidatorProxy");
                const vpc1 = (await hardhat.ethers.getContractAt(validatorProxyArtifact.abi, vp)) as ValidatorProxy;
                expect(await vpc1.operator()).equal(nodeOperatorRegistryContract.address);
                expect(await vpc1.implementation()).equal(validatorContract.address);
                expect(await vpc1.validatorFactory()).equal(validatorFactoryContract.address);
            }
        });
    });

    describe("Validator factory", async function () {
        it("check validator factory", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await stakeOperator(3, user3, user3Address, "10", "20");
            expect(await validatorFactoryContract.validatorImplementation())
                .equal(validatorContract.address);

            expect((await validatorFactoryContract.getValidators()).length).eq(3);
        });
    });

    describe("Upgrade contracts", async function () {
        it("Success upgrade validator Proxy validator implementation", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            const validatorArtifactV2: Artifact = await hardhat.artifacts.readArtifact("ValidatorV2");
            const validatorContractV2 = await deployContract(
                signer,
                validatorArtifactV2,
                []
            );

            const validatorProxyArtifact: Artifact = await hardhat.artifacts.readArtifact("ValidatorProxy");
            await validatorFactoryContract.setValidatorImplementation(validatorContractV2.address);
            const validatorProxies = await validatorFactoryContract.getValidators();

            for (let i = 0; i < validatorProxies.length; i++) {
                const vp = (await hardhat.ethers.getContractAt(validatorProxyArtifact.abi, validatorProxies[i])) as ValidatorProxy;
                expect(await vp.implementation()).equal(validatorContractV2.address);

                await signer.sendTransaction({
                    to: vp.address,
                    data: new ethers.utils.Interface(validatorArtifactV2.abi)
                        .encodeFunctionData("setX", [i + 10])
                });

                const res = await signer.call({
                    to: vp.address,
                    data: new ethers.utils.Interface(validatorArtifactV2.abi).encodeFunctionData("getX")
                });

                const x = new ethers.utils.Interface(validatorArtifactV2.abi).decodeFunctionResult("getX", res);
                expect(x[0], "X is not valid").to.equal(i + 10);
            }
        });

        it("Fail to upgrade validator factory validatorImplementation", async function () {
            // add a new node operator
            await newOperator(1, user1Address);
            const validatorArtifactV2: Artifact = await hardhat.artifacts.readArtifact("ValidatorV2");
            const validatorContractV2 = await deployContract(
                signer,
                validatorArtifactV2,
                []
            );
            await expect(
                validatorFactoryContract.connect(user1).setValidatorImplementation(validatorContractV2.address)
            ).revertedWith("Permission not found");
        });

        it("Success upgrade validator factory", async function () {
            const validatorFactoryV2Artifact = await ethers.getContractFactory("ValidatorFactoryV2");
            const validatorFactoryV2Contract = (
                await upgrades.upgradeProxy(validatorFactoryContract, validatorFactoryV2Artifact)
            ) as ValidatorFactoryV2;

            expect(validatorFactoryV2Contract.address).equal(validatorFactoryContract.address);
            await validatorFactoryV2Contract.setX(10);
            expect(await validatorFactoryV2Contract.getX()).equal(10);
        });

        it("Success upgrade node operator registry", async function () {
            await stakeOperator(1, user1, user1Address, "100", "20");
            await stakeOperator(2, user2, user2Address, "100", "20");

            const NodeOperatorRegistryV2Artifact = await ethers.getContractFactory("NodeOperatorRegistryV2");
            const NodeOperatorRegistryV2Contract = (
                await upgrades.upgradeProxy(nodeOperatorRegistryContract.address, NodeOperatorRegistryV2Artifact)
            ) as NodeOperatorRegistryV2;

            expect(await nodeOperatorRegistryContract.address === NodeOperatorRegistryV2Contract.address);
        });
    });
});

// generate fake data for validator
function getValidatorFakeData (): { name: string; signerPubkey: string } {
    return {
        name: "node1",
        signerPubkey: ethers.utils.hexZeroPad("0x01", 64)
    };
}

// create a new validator
async function newOperator (_id: number, userAddress: string, signer?: Signer) {
    const { name, signerPubkey } = getValidatorFakeData();

    // add new node operator
    expect(await nodeOperatorRegistryContract.addOperator(
        name,
        userAddress,
        signerPubkey
    )).to.emit(nodeOperatorRegistryContract, "AddOperator").withArgs(
        _id, name, signerPubkey
    );
    return { name, signerPubkey };
}

async function stakeOperator (this: any, id: number, user: Signer, address: string, amount: string, heimdallFees: string) {
    await newOperator(id, address);

    // get node operator
    const no1 = await nodeOperatorRegistryContract["getNodeOperator(uint256)"].call(this, id);

    const total = String(Number(amount) + Number(heimdallFees));
    // approve token to validator contract
    await polygonERC20Contract.connect(user).approve(no1.validatorProxy, toEth(total));

    // stake a node operator
    expect(await nodeOperatorRegistryContract.connect(user)
        .stake(toEth(amount), toEth(heimdallFees)))
        .to.emit(nodeOperatorRegistryContract, "StakeOperator")
        .withArgs(id, toEth(amount), toEth(heimdallFees));
}

// convert a string to ether
function toEth (amount: string): BigNumber {
    return ethers.utils.parseEther(amount);
}

async function checkStats (totalNodeOperator: number,
    totalInactiveNodeOperator: number,
    totalActiveNodeOperator: number,
    totalStoppedNodeOperator: number,
    totalUnstakedNodeOperator: number,
    totalClaimedNodeOperator: number,
    totalExitNodeOperator: number
) {
    const stats = await nodeOperatorRegistryContract.getState();
    expect(stats[0].toNumber(), "totalNodeOperator").equal(totalNodeOperator);
    expect(stats[1].toNumber(), "totalInactiveNodeOperator").equal(totalInactiveNodeOperator);
    expect(stats[2].toNumber(), "totalActiveNodeOperator").equal(totalActiveNodeOperator);
    expect(stats[3].toNumber(), "totalStoppedNodeOperator").equal(totalStoppedNodeOperator);
    expect(stats[4].toNumber(), "totalUnstakedNodeOperator").equal(totalUnstakedNodeOperator);
    expect(stats[5].toNumber(), "totalClaimedNodeOperator").equal(totalClaimedNodeOperator);
    expect(stats[6].toNumber(), "totalExitNodeOperator").equal(totalExitNodeOperator);
}

async function checkOperator (this: any, id: number, no: {
    status?: number;
    name?: string;
    rewardAddress?: string;
    validatorId?: BigNumber;
    signerPubkey?: string;
    validatorShare?: string;
    validatorProxy?: string;
    commissionRate?: BigNumber;
    slashed?: BigNumber;
    slashedTimestamp?: BigNumber;
    statusUpdatedTimestamp?: BigNumber;
    maxDelegateLimit?: BigNumber
}
) {
    const res = await nodeOperatorRegistryContract["getNodeOperator(uint256)"].call(this, id);

    if (no.status) {
        expect(res.status, "status").equal(no.status);
    }
    if (no.name) {
        expect(res.name, "name").equal(no.name);
    }
    if (no.rewardAddress) {
        expect(res.rewardAddress, "rewardAddress").equal(no.rewardAddress);
    }
    if (no.validatorId) {
        expect(res.validatorId, "validatorId").equal(no.validatorId);
    }
    if (no.signerPubkey) {
        expect(res.signerPubkey, "signerPubkey").equal(no.signerPubkey);
    }
    if (no.validatorShare) {
        expect(res.validatorShare, "validatorShare").equal(no.validatorShare);
    }
    if (no.validatorProxy) {
        expect(res.validatorProxy, "validatorProxy").equal(no.validatorProxy);
    }
    if (no.commissionRate) {
        expect(res.commissionRate, "commissionRate").equal(no.commissionRate);
    }
    if (no.slashed) {
        expect(res.slashed, "slashed").equal(no.slashed);
    }
    if (no.slashedTimestamp) {
        expect(res.slashedTimestamp, "slashedTimestamp").equal(no.slashedTimestamp);
    }
    if (no.statusUpdatedTimestamp) {
        expect(res.statusUpdatedTimestamp, "statusUpdatedTimestamp").not.equal(no.statusUpdatedTimestamp);
    }
    if (no.maxDelegateLimit) {
        expect(res.maxDelegateLimit, "maxDelegateLimit").equal(no.maxDelegateLimit);
    }
}
