import hardhat, { ethers, upgrades } from "hardhat";
import { Signer, Contract, BigNumber } from "ethers";
import { expect } from "chai";
import {} from "hardhat/types";
import {
    ValidatorFactory,
    ValidatorFactory__factory,
    NodeOperatorRegistry__factory,
    NodeOperatorRegistry,
    ValidatorProxy,
    ERC721Test,
    StakeManagerMock,
    ValidatorFactoryV2,
    NodeOperatorRegistryV2,
    StMATICMock,
    Polygon,
    ValidatorShareMock,
    Polygon__factory,
    ERC721Test__factory,
    StakeManagerMock__factory,
    Validator__factory,
    StMATICMock__factory,
    ValidatorV2__factory
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

let signer: SignerWithAddress;
let user1: Signer;
let user1Address: string;
let user2: SignerWithAddress;
let user2Address: string;
let user3: SignerWithAddress;
let user3Address: string;
let accounts: SignerWithAddress[];

let nodeOperatorRegistry: NodeOperatorRegistry;
let validatorFactory: ValidatorFactory;
let stMATICMock: StMATICMock;
let polygonERC20: Polygon;
let polygonERC721: ERC721Test;
let stakeManagerMock: StakeManagerMock;
let validator: Contract;
const ZERO_ADDRESS = ethers.constants.AddressZero;

describe("NodeOperator", function () {
    beforeEach(async function () {
        accounts = await ethers.getSigners();
        signer = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];
        user1Address = await user1.getAddress();
        user2Address = await user2.getAddress();
        user3Address = await user3.getAddress();

        // deploy ERC20 token
        const PolygonERC20 = (await ethers.getContractFactory(
            "Polygon"
        )) as Polygon__factory;
        polygonERC20 = await PolygonERC20.deploy();
        await polygonERC20.deployed();

        // deploy ERC721 token
        const PolygonERC721 = (await ethers.getContractFactory(
            "ERC721Test"
        )) as ERC721Test__factory;
        polygonERC721 = await PolygonERC721.deploy();
        await polygonERC721.deployed();

        // deploy stake manager mock
        const StakeManagerMock = (await ethers.getContractFactory(
            "StakeManagerMock"
        )) as StakeManagerMock__factory;
        stakeManagerMock = await StakeManagerMock.deploy(
            polygonERC20.address,
            polygonERC721.address
        );
        await stakeManagerMock.deployed();

        const Validator = (await ethers.getContractFactory(
            "Validator"
        )) as Validator__factory;
        validator = await Validator.deploy();
        await validator.deployed();

        // deploy validator factory
        const ValidatorFactory = (await ethers.getContractFactory(
            "ValidatorFactory"
        )) as ValidatorFactory__factory;
        validatorFactory = (await upgrades.deployProxy(ValidatorFactory, [
            validator.address,
            ethers.constants.AddressZero
        ])) as ValidatorFactory;

        // deploy node operator contract
        const NodeOperatorRegistry = (await ethers.getContractFactory(
            "NodeOperatorRegistry"
        )) as NodeOperatorRegistry__factory;
        nodeOperatorRegistry = (await upgrades.deployProxy(NodeOperatorRegistry, [
            validatorFactory.address,
            stakeManagerMock.address,
            polygonERC20.address,
            ethers.constants.AddressZero
        ])) as NodeOperatorRegistry;
        await nodeOperatorRegistry.deployed();

        // deploy stMATIC mock contract
        const StMATICMock = (await ethers.getContractFactory(
            "StMATICMock"
        )) as StMATICMock__factory;
        stMATICMock = await StMATICMock.deploy();
        await stMATICMock.deployed();

        await validatorFactory.setOperator(nodeOperatorRegistry.address);
        await nodeOperatorRegistry.setStMATIC(stMATICMock.address);
        await stMATICMock.setOperator(nodeOperatorRegistry.address);

        // transfer some funds to the stake manager, so we can use it to withdraw rewards.
        await polygonERC20.mint(ethers.utils.parseEther("130000"));
        await polygonERC20.transfer(
            stakeManagerMock.address,
            ethers.utils.parseEther("10000")
        );

        await polygonERC20.transfer(user1Address, toEth("1000"));
        await polygonERC20.transfer(user2Address, toEth("1000"));
        await polygonERC20.transfer(user3Address, toEth("1000"));
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
            await checkStats(2, 2, 0, 0, 0, 0, 0, 0, 0);

            // get all validator proxies from the factory.
            const validatorProxies = await validatorFactory.getValidators();
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
                maxDelegateLimit: BigNumber.from(toEth("10"))
            });
        });

        it("Fail to add new operator", async function () {
            const { name, signerPubkey } = getValidatorFakeData();

            // revert the caller has no permission.
            await expect(
                nodeOperatorRegistry
                    .connect(user1)
                    .addOperator(name, user1Address, signerPubkey)
            ).to.revertedWith("unauthorized");

            // revert reward address is zero.
            await expect(
                nodeOperatorRegistry.addOperator(
                    name,
                    ethers.constants.AddressZero,
                    signerPubkey
                )
            ).to.revertedWith("Address used");

            // add operator
            await newOperator(1, user1Address);

            // revert user try to add another operator with the same reward address
            await expect(
                nodeOperatorRegistry.addOperator(name, user1Address, signerPubkey)
            ).to.revertedWith("Address used");
        });

        it("Success stake an operator", async function () {
            // add a new node operator
            await newOperator(1, user1Address);
            await newOperator(2, user2Address);

            // get node operator
            const no1 = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                1
            );
            const no2 = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                2
            );

            // approve token to validator contract
            await polygonERC20
                .connect(user1)
                .approve(no1.validatorProxy, toEth("100"));
            await polygonERC20
                .connect(user2)
                .approve(no2.validatorProxy, toEth("100"));

            // stake a node operator
            expect(
                await nodeOperatorRegistry
                    .connect(user1)
                    .stake(toEth("80"), toEth("20"))
            )
                .to.emit(nodeOperatorRegistry, "StakeOperator")
                .withArgs(1, toEth("80"), toEth("20"));

            expect(
                await nodeOperatorRegistry
                    .connect(user2)
                    .stake(toEth("50"), toEth("50"))
            )
                .to.emit(nodeOperatorRegistry, "StakeOperator")
                .withArgs(2, toEth("50"), toEth("50"));

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
            await checkStats(2, 0, 2, 0, 0, 0, 0, 0, 0);
        });

        it("Fail to stake an operator", async function () {
            // add a new node operator
            await newOperator(1, user1Address);

            // revert the amount and heimdall fees are zero.
            await expect(
                nodeOperatorRegistry.connect(user1).stake(toEth("0"), toEth("20"))
            ).to.revertedWith("Invalid amount");

            // revert the amount and heimdall fees are zero.
            await expect(
                nodeOperatorRegistry.connect(user1).stake(toEth("10"), toEth("0"))
            ).to.revertedWith("Invalid fees");

            // revert the caller isn't the owner(owner is user1 and here the signer is the caller).
            await expect(
                nodeOperatorRegistry.stake(toEth("10"), toEth("20"))
            ).to.revertedWith("Operator not found");

            // get node operator
            const no = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                1
            );

            // approve token to validator contract
            await polygonERC20.connect(user1).approve(no.validatorProxy, toEth("30"));

            // stake a node operator
            expect(
                await nodeOperatorRegistry
                    .connect(user1)
                    .stake(toEth("10"), toEth("20"))
            );

            // revert try to stake the same operator 2 times
            await expect(
                nodeOperatorRegistry.connect(user1).stake(toEth("10"), toEth("20"))
            ).to.revertedWith("Invalid status");
        });

        it("success stop an operator", async function () {
            await newOperator(1, user1Address);
            expect(await nodeOperatorRegistry.stopOperator(1))
                .to.emit(nodeOperatorRegistry, "StopOperator")
                .withArgs(1);

            await checkOperator(1, { status: 5 });

            // check global state
            await checkStats(1, 0, 0, 0, 0, 0, 1, 0, 0);

            await stakeOperator(2, user2, user2Address, "10", "20");
            expect(await nodeOperatorRegistry.stopOperator(2))
                .to.emit(nodeOperatorRegistry, "StopOperator")
                .withArgs(2);

            await checkOperator(2, { status: 2 });

            // check global state
            await checkStats(2, 0, 0, 1, 0, 0, 1, 0, 0);
        });

        it("should stop a JAILED operator", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeManagerMock.slash(1);
            expect(await nodeOperatorRegistry.stopOperator(1))
                .to.emit(nodeOperatorRegistry, "StopOperator")
                .withArgs(1);
            await checkOperator(1, { status: 2 });
        });

        it("should stop an operator authorized by the operator owner", async function (){
            await newOperator(1, user1Address);
            expect(await nodeOperatorRegistry.connect(user1).stopOperator(1))
                .to.emit(nodeOperatorRegistry, "StopOperator")
                .withArgs(1);
        });

        it("Fail stop an operator", async function () {
            // revert invalid operator id
            await expect(nodeOperatorRegistry.stopOperator(10)).revertedWith(
                "Operator not found"
            );
            // add + stake an operator
            await stakeOperator(1, user1, user1Address, "10", "20");

            // success stop first time
            await nodeOperatorRegistry.stopOperator(1);

            // revert stop second time
            await expect(nodeOperatorRegistry.stopOperator(1)).to.revertedWith(
                "Invalid status"
            );

            await expect(nodeOperatorRegistry.connect(user2).stopOperator(1)).to.revertedWith(
                "unauthorized"
            );
        });

        it("Success join an operator", async function () {
            await polygonERC20.approve(stakeManagerMock.address, toEth("30"));
            await stakeManagerMock.stakeFor(
                user1Address,
                toEth("10"),
                toEth("20"),
                true,
                ethers.utils.hexZeroPad("0x01", 64)
            );

            await newOperator(1, user1Address);
            await polygonERC721.mint(user1Address, 1);

            let no = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                1
            );
            await polygonERC721.connect(user1).approve(no.validatorProxy, 1);

            expect(await nodeOperatorRegistry.connect(user1).joinOperator())
                .to.emit(nodeOperatorRegistry, "JoinOperator")
                .withArgs(1);

            expect(await polygonERC721.ownerOf(1)).equal(no.validatorProxy);

            await checkOperator(1, {
                status: 1,
                validatorId: BigNumber.from(1),
                validatorProxy: no.validatorProxy
            });

            no = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(this, 1);
            expect(no.validatorShare).not.equal(ZERO_ADDRESS);
            await checkStats(1, 0, 1, 0, 0, 0, 0, 0, 0);
        });

        it("Fail join an operator", async function () {
            // revert invalid operator id
            await expect(nodeOperatorRegistry.joinOperator()).revertedWith(
                "Operator not found"
            );

            await stakeOperator(1, user1, user1Address, "10", "20");

            await expect(
                nodeOperatorRegistry.connect(user1).joinOperator()
            ).revertedWith("Invalid status");

            await newOperator(2, user2Address);
            await expect(
                nodeOperatorRegistry.connect(user2).joinOperator()
            ).revertedWith("ValidatorId=0");
        });

        it("Should fail to join an operator if unstaked", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");

            await stakeManagerMock.unstake(1);
            await checkOperator(1, { status: 7 });

            await expect(
                nodeOperatorRegistry.connect(user1).joinOperator()
            ).revertedWith("Invalid status");
        });

        it("Success restake an operator", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            // set restake to true
            await nodeOperatorRegistry.setRestake(true);

            // get node operators
            const no1 = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                1
            );
            const no2 = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                2
            );

            // approve token to validator contract
            await polygonERC20
                .connect(user1)
                .approve(no1.validatorProxy, toEth("50"));
            await polygonERC20
                .connect(user2)
                .approve(no2.validatorProxy, toEth("100"));

            // restake a node operator
            expect(
                await nodeOperatorRegistry.connect(user1).restake(toEth("50"), true)
            )
                .to.emit(nodeOperatorRegistry, "RestakeOperator")
                .withArgs(1, toEth("50"), true);

            // restake a node operator
            expect(
                await nodeOperatorRegistry.connect(user2).restake(toEth("100"), false)
            )
                .to.emit(nodeOperatorRegistry, "RestakeOperator")
                .withArgs(2, toEth("100"), false);

            await checkStats(2, 0, 2, 0, 0, 0, 0, 0, 0);
        });

        it("Fail restake an operator", async function () {
            // add a new node operator
            await newOperator(1, user1Address);

            // revert restake isn't enabled by the DAO
            await expect(
                nodeOperatorRegistry.connect(user1).restake(toEth("0"), true)
            ).to.revertedWith("Restake is disabled");

            // set restake to true
            await nodeOperatorRegistry.setRestake(true);

            // revert amount = 0 and restake rewards is false
            await expect(
                nodeOperatorRegistry.connect(user1).restake(toEth("0"), true)
            ).to.revertedWith("Amount is ZERO");

            // revert user2 has no operator
            await expect(
                nodeOperatorRegistry.connect(user2).restake(toEth("10"), true)
            ).to.revertedWith("Operator not found");

            // revert operator not active
            await expect(
                nodeOperatorRegistry.connect(user1).restake(toEth("10"), true)
            ).to.revertedWith("Invalid status");
        });

        it("Success unstake an operator", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            // unstake a node operator
            expect(await nodeOperatorRegistry.connect(user1)["unstake()"].call(this))
                .to.emit(nodeOperatorRegistry, "UnstakeOperator")
                .withArgs(1);

            await checkOperator(1, { status: 3 });
            await checkStats(2, 0, 1, 0, 1, 0, 0, 0, 0);
        });

        it("Success unstake an operator by the DAO", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            await stakeManagerMock.unstake(1);
            await checkStats(2, 0, 1, 0, 0, 0, 0, 0, 1);

            // DAO unstake a node operator 1
            expect(await nodeOperatorRegistry["unstake(uint256)"].call(this, 1))
                .to.emit(nodeOperatorRegistry, "UnstakeOperator")
                .withArgs(1);

            await checkOperator(1, { status: 3 });
            await checkStats(2, 0, 1, 0, 1, 0,0, 0, 0);

            await stakeManagerMock.unstake(2);
            await checkStats(2, 0, 0, 0, 1, 0,0, 0, 1);

            // DAO unstake a node operator 2
            expect(await nodeOperatorRegistry["unstake(uint256)"].call(this, 2))
                .to.emit(nodeOperatorRegistry, "UnstakeOperator")
                .withArgs(2);
            await checkOperator(2, { status: 3 });
            await checkStats(2, 0, 0, 0, 2, 0, 0, 0, 0);
        });

        it("Fail unstake an operator by the DAO", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");

            await stakeManagerMock.unstake(1);
            // DAO unstake a node operator 1
            await expect(nodeOperatorRegistry.connect(user1)["unstake(uint256)"].call(this, 1))
                .revertedWith("unauthorized");
        });

        it("Success unstake when the operator was unstaked by the stakeManager", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            // await stakeManagerMock.unstake(1);
            // unstake a node operator
            expect(await nodeOperatorRegistry.connect(user1)["unstake()"].call(this))
                .to.emit(nodeOperatorRegistry, "UnstakeOperator")
                .withArgs(1);

            await checkOperator(1, { status: 3 });
            await checkStats(2, 0, 1, 0, 1, 0, 0, 0, 0);
        });

        it("Successfully unstake when the operator was jailed by the stakeManager", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");

            await stakeManagerMock.slash(1);
            expect(await nodeOperatorRegistry.connect(user1)["unstake()"].call(this))
                .to.emit(nodeOperatorRegistry, "UnstakeOperator")
                .withArgs(1);

            await checkOperator(1, { status: 3 });
        });

        it("Fail to unstake an operator", async function () {
            // revert caller try to unstake a operator that not exist.
            await expect(
                nodeOperatorRegistry.connect(user1)["unstake()"].call(this)
            ).to.revertedWith("Operator not found");

            // add a new node operator.
            await newOperator(1, user1Address);

            // revert caller try to unstake a operator that has not yet staked
            await expect(
                nodeOperatorRegistry.connect(user1)["unstake()"].call(this)
            ).to.revertedWith("Invalid status");

            // stake an operator.
            await stakeOperator(2, user2, user2Address, "10", "20");

            // unstake
            await nodeOperatorRegistry.connect(user2)["unstake()"].call(this);

            // revert try to unstake a second time.
            await expect(
                nodeOperatorRegistry.connect(user2)["unstake()"].call(this)
            ).to.revertedWith("Invalid status");
        });

        it("Success migrate NFT to new owner", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await nodeOperatorRegistry.stopOperator(1);

            const no = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                1
            );
            await polygonERC721.mint(no.validatorProxy, 1);

            await stMATICMock.claimTokens2StMatic(no.validatorShare);

            expect(await nodeOperatorRegistry.connect(user1).migrate())
                .to.emit(nodeOperatorRegistry, "MigrateOperator")
                .withArgs(1);

            await checkOperator(1, { status: 5 });
            await checkStats(2, 0, 1, 0, 0, 0, 1, 0, 0);
        });

        it("Fail migrate NFT to new owner", async function () {
            // revert caller try to unstake a operator that not exist.
            await expect(
                nodeOperatorRegistry.connect(user1).migrate()
            ).to.revertedWith("Operator not found");

            // add a new node operator.
            await stakeOperator(1, user1, user1Address, "10", "20");

            // revert caller try to unstake a operator that has not yet staked
            await expect(
                nodeOperatorRegistry.connect(user1).migrate()
            ).to.revertedWith("Invalid status");

            const no = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                1
            );
            await polygonERC721.mint(no.validatorProxy, 1);
            await nodeOperatorRegistry.stopOperator(1);

            await stMATICMock.claimTokens2StMatic(no.validatorShare);

            // revert caller try to unstake a operator that has not yet staked
            await nodeOperatorRegistry.connect(user1).migrate();

            // revert caller try to unstake a operator that has not yet staked
            await expect(
                nodeOperatorRegistry.connect(user1).migrate()
            ).to.revertedWith("Invalid status");
        });

        it("Success to exitOperator", async function () {
            // add a new node operator.
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await stakeOperator(3, user3, user3Address, "10", "20");

            const no1 = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                1
            );
            await polygonERC721.mint(no1.validatorProxy, 1);
            const no2 = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                2
            );
            await polygonERC721.mint(no2.validatorProxy, 2);
            const no3 = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                3
            );
            await polygonERC721.mint(no3.validatorProxy, 3);

            await nodeOperatorRegistry.stopOperator(1);
            await nodeOperatorRegistry.stopOperator(2);
            await nodeOperatorRegistry.stopOperator(3);

            await checkStats(3, 0, 0, 3, 0, 0, 0, 0, 0);

            await stMATICMock.claimTokens2StMatic(no1.validatorShare);
            await stMATICMock.claimTokens2StMatic(no2.validatorShare);
            await stMATICMock.claimTokens2StMatic(no3.validatorShare);

            await nodeOperatorRegistry.connect(user1).migrate();
            await nodeOperatorRegistry.connect(user2).migrate();
            await nodeOperatorRegistry.connect(user3).migrate();

            await checkStats(3, 0, 0, 0, 0, 0, 3, 0, 0);
        });

        it("Shouldn't allow claiming from non exited operator", async () => {
            const operatorIds = [1, 2, 3];
            const stakeAmount = "10";
            const heimdallFees = "20";
            await Promise.all(
                operatorIds.map((id, index) => {
                    const user = accounts[index];
                    return stakeOperator(
                        id,
                        user,
                        user.address,
                        stakeAmount,
                        heimdallFees
                    );
                })
            );
        });

        it("Success to unjail an operator", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeManagerMock.slash(1);

            expect(await nodeOperatorRegistry.connect(user1).unjail())
                .to.emit(nodeOperatorRegistry, "Unjail")
                .withArgs(1);

            await checkOperator(1, { status: 1 });
            await checkStats(1, 0, 1, 0, 0, 0, 0, 0, 0);
        });

        it("Success to topUpFee", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            const no1 = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                1
            );
            const no2 = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                2
            );

            // approve token to validator proxy
            await polygonERC20
                .connect(user1)
                .approve(no1.validatorProxy, toEth("50"));
            await polygonERC20
                .connect(user2)
                .approve(no2.validatorProxy, toEth("100"));

            expect(await nodeOperatorRegistry.connect(user1).topUpForFee(toEth("50")))
                .to.emit(nodeOperatorRegistry, "TopUpHeimdallFees")
                .withArgs(1, toEth("50"));

            expect(
                await nodeOperatorRegistry.connect(user2).topUpForFee(toEth("100"))
            )
                .to.emit(nodeOperatorRegistry, "TopUpHeimdallFees")
                .withArgs(2, toEth("100"));
        });

        it("Fail to topUpFee", async function () {
            // revert the caller has no node operator.
            await expect(
                nodeOperatorRegistry.connect(user1).topUpForFee(toEth("20"))
            ).to.revertedWith("Operator not found");

            await newOperator(1, user1Address);

            // revert heimdall fees = 0
            await expect(
                nodeOperatorRegistry.connect(user1).topUpForFee(0)
            ).to.revertedWith("Invalid fees");

            // revert topup on a no staked operator
            await expect(
                nodeOperatorRegistry.connect(user1).topUpForFee(toEth("20"))
            ).to.revertedWith("Invalid status");
        });

        it("Success unstake claim", async function () {
            const beforeBalance1 = await polygonERC20.balanceOf(user1Address);
            const beforeBalance2 = await polygonERC20.balanceOf(user2Address);

            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await nodeOperatorRegistry.connect(user1)["unstake()"].call(this);
            await nodeOperatorRegistry.connect(user2)["unstake()"].call(this);

            expect(await nodeOperatorRegistry.connect(user1).unstakeClaim()).to.emit(
                nodeOperatorRegistry,
                "UnstakeClaim"
            );

            expect(await nodeOperatorRegistry.connect(user2).unstakeClaim()).to.emit(
                nodeOperatorRegistry,
                "UnstakeClaim"
            );

            const afterBalance1 = await polygonERC20.balanceOf(user1Address);
            const afterBalance2 = await polygonERC20.balanceOf(user2Address);
            expect(beforeBalance1.toString(), "beforeBalance").not.equal(
                afterBalance1.toString()
            );
            expect(beforeBalance2.toString(), "beforeBalance").not.equal(
                afterBalance2.toString()
            );

            await checkOperator(1, { status: 4 });
            await checkOperator(2, { status: 4 });
            await checkStats(2, 0, 0, 0, 0, 2, 0, 0, 0);
        });

        it("Fail unstake claim", async function () {
            // revert the caller has no node operator.
            await expect(
                nodeOperatorRegistry.connect(user1).unstakeClaim()
            ).to.revertedWith("Operator not found");

            await newOperator(1, user1Address);

            // revert the operator isn't in unstaked state.
            await expect(
                nodeOperatorRegistry.connect(user1).unstakeClaim()
            ).to.revertedWith("Invalid status");

            await stakeOperator(2, user2, user2Address, "10", "20");
            await nodeOperatorRegistry.connect(user2)["unstake()"].call(this);

            // revert the operator isn't in unstaked state.
            await nodeOperatorRegistry.connect(user2).unstakeClaim();

            // revert try to claim 2 times.
            await expect(
                nodeOperatorRegistry.connect(user2).unstakeClaim()
            ).to.revertedWith("Invalid status");
        });

        it("Success claim heimdall fees", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await nodeOperatorRegistry.connect(user1)["unstake()"].call(this);
            await nodeOperatorRegistry.connect(user2)["unstake()"].call(this);
            await nodeOperatorRegistry.connect(user1).unstakeClaim();
            await nodeOperatorRegistry.connect(user2).unstakeClaim();

            await nodeOperatorRegistry
                .connect(user1)
                .claimFee(1, 1, ethers.utils.randomBytes(64));

            await nodeOperatorRegistry
                .connect(user2)
                .claimFee(1, 1, ethers.utils.randomBytes(64));

            await checkOperator(1, { status: 5 });
            await checkOperator(2, { status: 5 });

            await checkStats(2, 0, 0, 0, 0, 0, 2, 0, 0);
        });

        it("Fail claim heimdall fees", async function () {
            await expect(
                nodeOperatorRegistry
                    .connect(user2)
                    .claimFee(1, 1, ethers.utils.randomBytes(64))
            ).to.revertedWith("Operator not found");

            // add a new node operator
            await newOperator(1, user1Address);

            // revert claim fees before unstake claim
            await expect(
                nodeOperatorRegistry
                    .connect(user1)
                    .claimFee(1, 1, ethers.utils.randomBytes(64))
            ).to.revertedWith("Invalid status");

            await stakeOperator(2, user2, user2Address, "10", "20");
            await nodeOperatorRegistry.connect(user2)["unstake()"].call(this);
            await nodeOperatorRegistry.connect(user2).unstakeClaim();
            await nodeOperatorRegistry
                .connect(user2)
                .claimFee(1, 1, ethers.utils.randomBytes(64));

            // revert try to claim 2 times
            await expect(
                nodeOperatorRegistry
                    .connect(user1)
                    .claimFee(1, 1, ethers.utils.randomBytes(64))
            ).to.revertedWith("Invalid status");
        });

        it("Success withdraw validator rewards", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            // simulate rewards on stake manager
            await polygonERC20.transfer(stakeManagerMock.address, toEth("200"));

            // get users balance before request withdraw rewards
            const b1 = await polygonERC20.balanceOf(user1Address);
            const b2 = await polygonERC20.balanceOf(user2Address);

            // users request withdraw rewards
            expect(
                await nodeOperatorRegistry.connect(user1).withdrawRewards()
            ).to.emit(nodeOperatorRegistry, "WithdrawRewards");
            expect(
                await nodeOperatorRegistry.connect(user2).withdrawRewards()
            ).to.emit(nodeOperatorRegistry, "WithdrawRewards");
            // get users balance before request withdraw rewards
            const a1 = await polygonERC20.balanceOf(user1Address);
            const a2 = await polygonERC20.balanceOf(user2Address);

            expect(b1, "balance user1").not.eq(a1);
            expect(b2, "balance user2").not.eq(a2);
        });

        it("Fail withdraw validator rewards", async function () {
            // revert operator not exists
            await expect(nodeOperatorRegistry.withdrawRewards()).to.revertedWith(
                "Operator not found"
            );

            // add operator
            await newOperator(1, user1Address);

            // revert withdraw rewards before stake
            await expect(
                nodeOperatorRegistry.connect(user1).withdrawRewards()
            ).to.revertedWith("Invalid status");
        });

        it("Success update signer publickey", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");

            const newSignPubkey = ethers.utils.hexZeroPad("0x02", 64);
            expect(
                await nodeOperatorRegistry.connect(user1).updateSigner(newSignPubkey)
            )
                .to.emit(nodeOperatorRegistry, "UpdateSignerPubkey")
                .withArgs(1);
            await checkOperator(1, { signerPubkey: newSignPubkey });

            await newOperator(2, user2Address);

            expect(
                await nodeOperatorRegistry.connect(user2).updateSigner(newSignPubkey)
            )
                .to.emit(nodeOperatorRegistry, "UpdateSignerPubkey")
                .withArgs(2);
            await checkOperator(2, { signerPubkey: newSignPubkey });
        });

        it("Fail update signer publickey", async function () {
            const newSignPubkey = ethers.utils.hexZeroPad("0x02", 64);
            // revert operator not exists
            await expect(
                nodeOperatorRegistry.connect(user1).updateSigner(newSignPubkey)
            ).to.revertedWith("Operator not found");

            await stakeOperator(1, user1, user1Address, "10", "20");
            await nodeOperatorRegistry.connect(user1)["unstake()"].call(this);

            await expect(
                nodeOperatorRegistry.connect(user1).updateSigner(newSignPubkey)
            ).to.revertedWith("Invalid status");
        });

        it("Success set operator name", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            const newName = "super node";
            expect(await nodeOperatorRegistry.connect(user1).setOperatorName(newName))
                .to.emit(nodeOperatorRegistry, "NewName")
                .withArgs(1, newName);
            await checkOperator(1, { name: newName });

            await newOperator(2, user2Address);
            expect(await nodeOperatorRegistry.connect(user2).setOperatorName(newName))
                .to.emit(nodeOperatorRegistry, "NewName")
                .withArgs(2, newName);
            await checkOperator(2, { name: newName });
        });

        it("Fail set operator name", async function () {
            const newName = "super node";
            await expect(
                nodeOperatorRegistry.connect(user1).setOperatorName(newName)
            ).to.revertedWith("Operator not found");
        });

        it("Success set operator reward address", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");

            // change rewardAddress from user1 to user2
            expect(
                await nodeOperatorRegistry
                    .connect(user1)
                    .setOperatorRewardAddress(user2Address)
            )
                .to.emit(nodeOperatorRegistry, "NewRewardAddress")
                .withArgs(1, user2Address);
            await checkOperator(1, { rewardAddress: user2Address });

            // the new owner tries to update the name
            const newName = "super node";
            expect(await nodeOperatorRegistry.connect(user2).setOperatorName(newName))
                .to.emit(nodeOperatorRegistry, "NewName")
                .withArgs(1, newName);
            await checkOperator(1, { name: newName });
        });

        it("Fail set operator reward address", async function () {
            await expect(
                nodeOperatorRegistry
                    .connect(user1)
                    .setOperatorRewardAddress(user2Address)
            ).to.revertedWith("Operator not found");

            await stakeOperator(1, user1, user1Address, "10", "20");
            await expect(
                nodeOperatorRegistry
                    .connect(user1)
                    .setOperatorRewardAddress(user1Address)
            ).to.revertedWith("Address used");
        });

        it("Success remove node operator", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await newOperator(3, user3Address);
            await checkStats(3, 1, 2, 0, 0, 0, 0, 0, 0);

            const no = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                this,
                2
            );
            await polygonERC721.mint(no.validatorProxy, 2);

            await nodeOperatorRegistry.connect(user1)["unstake()"].call(this);
            await checkStats(3, 1, 1, 0, 1, 0, 0, 0, 0);

            await nodeOperatorRegistry.stopOperator(2);
            await checkStats(3, 1, 0, 1, 1, 0, 0, 0, 0);

            await nodeOperatorRegistry.stopOperator(3);
            await checkStats(3, 0, 0, 1, 1, 0, 1, 0, 0);

            await nodeOperatorRegistry.connect(user1).unstakeClaim();
            await checkStats(3, 0, 0, 1, 0, 1, 1, 0, 0);

            await stMATICMock.claimTokens2StMatic(no.validatorShare);

            await nodeOperatorRegistry.connect(user2).migrate();
            await checkStats(3, 0, 0, 0, 0, 1, 2, 0, 0);

            await nodeOperatorRegistry
                .connect(user1)
                .claimFee(1, 1, ethers.utils.randomBytes(64));

            await checkStats(3, 0, 0, 0, 0, 0, 3, 0, 0);

            expect(await nodeOperatorRegistry.removeOperator(1))
                .to.emit(nodeOperatorRegistry, "RemoveOperator")
                .withArgs(1);
            expect(await nodeOperatorRegistry.removeOperator(2))
                .to.emit(nodeOperatorRegistry, "RemoveOperator")
                .withArgs(2);
            expect(await nodeOperatorRegistry.removeOperator(3))
                .to.emit(nodeOperatorRegistry, "RemoveOperator")
                .withArgs(3);

            await checkStats(0, 0, 0, 0, 0, 0, 0, 0, 0);

            expect(
                (await validatorFactory.getValidators()).length,
                "Total validator proxies"
            ).equal(0);
            expect(
                (await nodeOperatorRegistry.getOperatorIds()).length,
                "Total operator ids"
            ).equal(0);
        });

        it("Fail to remove operator", async function () {
            await newOperator(1, user1Address);
            await stakeOperator(2, user2, user2Address, "10", "20");

            await nodeOperatorRegistry.stopOperator(1);

            // revert remove node operator.
            await expect(
                nodeOperatorRegistry.connect(user1).removeOperator(1)
            ).to.revertedWith("unauthorized");

            // revert remove node operator that not exists.
            await expect(nodeOperatorRegistry.removeOperator(2)).to.revertedWith(
                "Invalid status"
            );

            await nodeOperatorRegistry.connect(user2)["unstake()"].call(this);

            // revert remove node operator that not exists.
            await expect(nodeOperatorRegistry.removeOperator(2)).to.revertedWith(
                "Invalid status"
            );

            await nodeOperatorRegistry.connect(user2).unstakeClaim();

            // revert remove node operator that not exists.
            await expect(nodeOperatorRegistry.removeOperator(2)).to.revertedWith(
                "Invalid status"
            );

            await nodeOperatorRegistry
                .connect(user2)
                .claimFee(1, 1, ethers.utils.randomBytes(64));
        });

        describe("DAO", async function () {
            it("Success setCommissionRate", async function () {
                const commission = 80;
                await nodeOperatorRegistry.setCommissionRate(
                    BigNumber.from(commission)
                );
                expect(await nodeOperatorRegistry.commissionRate()).eq(commission);
            });

            it("Fail setCommissionRate", async function () {
                const commission = 80;
                await expect(
                    nodeOperatorRegistry
                        .connect(user1)
                        .setCommissionRate(BigNumber.from(commission))
                ).revertedWith("unauthorized");
            });

            it("Success setCommissionRate", async function () {
                const commission = 80;
                await nodeOperatorRegistry.setCommissionRate(
                    BigNumber.from(commission)
                );
                expect(await nodeOperatorRegistry.commissionRate()).eq(commission);
            });

            it("Fail setCommissionRate", async function () {
                const commission = 80;
                await expect(
                    nodeOperatorRegistry
                        .connect(user1)
                        .setCommissionRate(BigNumber.from(commission))
                ).revertedWith("unauthorized");
            });

            it("Success updateOperatorCommissionRate", async function () {
                await newOperator(1, user1Address);
                const commission = BigNumber.from(10);
                expect(
                    await nodeOperatorRegistry.updateOperatorCommissionRate(1, commission)
                )
                    .to.emit(nodeOperatorRegistry, "UpdateCommissionRate")
                    .withArgs(1, commission);

                await checkOperator(1, { commissionRate: commission });
            });

            it("Fail updateOperatorCommissionRate", async function () {
                const commission = BigNumber.from(10);
                await expect(
                    nodeOperatorRegistry.updateOperatorCommissionRate(1, commission)
                ).revertedWith("Operator not found");

                await stakeOperator(1, user1, user1Address, "10", "20");

                await expect(
                    nodeOperatorRegistry
                        .connect(user1)
                        .updateOperatorCommissionRate(1, commission)
                ).revertedWith("unauthorized");
            });

            it("Success setStakeAmountAndFees", async function () {
                await newOperator(1, user1Address);
                const minAmountStake = BigNumber.from(toEth("10"));
                const minHeimdallFees = BigNumber.from(toEth("100"));
                await nodeOperatorRegistry.setStakeAmountAndFees(
                    minAmountStake,
                    minHeimdallFees
                );

                expect(await nodeOperatorRegistry.minAmountStake()).eq(minAmountStake);
                expect(await nodeOperatorRegistry.minHeimdallFees()).eq(
                    minHeimdallFees
                );
            });

            it("Fail setStakeAmountAndFees", async function () {
                const minAmountStake = BigNumber.from(10);
                const minHeimdallFees = BigNumber.from(100);
                await expect(
                    nodeOperatorRegistry
                        .connect(user1)
                        .setStakeAmountAndFees(minAmountStake, minHeimdallFees)
                ).revertedWith("unauthorized");
            });

            it("Success pause unpasue", async function () {
                await nodeOperatorRegistry.togglePause();
                await expect(newOperator(1, user1Address)).revertedWith(
                    "Pausable: paused"
                );
                await nodeOperatorRegistry.togglePause();
                await newOperator(1, user1Address);
            });

            it("Fail pause unpasue", async function () {
                await expect(
                    nodeOperatorRegistry.connect(user1).togglePause()
                ).revertedWith("unauthorized");
                await expect(
                    nodeOperatorRegistry.connect(user1).togglePause()
                ).revertedWith("unauthorized");
            });

            it("Success DAO setter", async function () {
                const address = "0x0000000000000000000000000000000000000010";
                const version = "1.11.0";
                await nodeOperatorRegistry.setStMATIC(address);
                await nodeOperatorRegistry.setValidatorFactory(address);
                await nodeOperatorRegistry.setStakeManager(address);
                await nodeOperatorRegistry.setVersion(version);
                await nodeOperatorRegistry.setRestake(true);

                const c = await nodeOperatorRegistry.getContracts();
                expect(c._stMATIC).eq(address);
                expect(c._validatorFactory).eq(address);
                expect(c._stakeManager).eq(address);

                expect(await nodeOperatorRegistry.allowsRestake()).true;
                expect(await nodeOperatorRegistry.version()).eq(version);
            });

            it("Fail DAO setter", async function () {
                const address = "0x0000000000000000000000000000000000000010";
                const version = "1.11.0";
                await expect(
                    nodeOperatorRegistry.connect(user1).setStMATIC(address)
                ).revertedWith("unauthorized");
                await expect(
                    nodeOperatorRegistry.connect(user1).setValidatorFactory(address)
                ).revertedWith("unauthorized");
                await expect(
                    nodeOperatorRegistry.connect(user1).setStakeManager(address)
                ).revertedWith("unauthorized");
                await expect(
                    nodeOperatorRegistry.connect(user1).setVersion(version)
                ).revertedWith("unauthorized");
                await expect(
                    nodeOperatorRegistry.connect(user1).setRestake(true)
                ).revertedWith("unauthorized");
            });
        });

        describe("operator infos", async function () {
            it("success getOperatorInfos all cases", async function () {
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeOperator(2, user2, user2Address, "100", "20");
                await stakeOperator(3, user3, user3Address, "100", "20");

                // slash op 1
                await stakeManagerMock.slash(1);
                // op 1 is not included
                let operators = await nodeOperatorRegistry.getOperatorInfos(false, false);
                expect(operators.length).eq(2);
                // op 1 is included
                operators = await nodeOperatorRegistry.getOperatorInfos(false, true);
                expect(operators.length).eq(3);

                // unstake op 2
                await stakeManagerMock.unstake(2);
                // op 2 is not included
                operators = await nodeOperatorRegistry.getOperatorInfos(false, false);
                expect(operators.length).eq(1);
                // include op2 + op1 (EJECTED, JAILED)
                operators = await nodeOperatorRegistry.getOperatorInfos(false, true);
                expect(operators.length).eq(3);

                // set operator 3 delegation to false
                const validatorShareOperator3: ValidatorShareMock =
                    (await ethers.getContractAt(
                        "ValidatorShareMock",
                        operators[2].validatorShare
                    )) as ValidatorShareMock;
                await validatorShareOperator3.updateDelegation(false);
                // include op3 is included because it's active
                operators = await nodeOperatorRegistry.getOperatorInfos(false, false);
                expect(operators.length).eq(1);

                // include op3 is not included delegation is false
                operators = await nodeOperatorRegistry.getOperatorInfos(true, false);
                expect(operators.length).eq(0);
            });

            it("success getOperatorInfos validator with active delegation", async function () {
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeOperator(2, user2, user2Address, "100", "20");
                await stakeOperator(3, user3, user3Address, "100", "20");

                let operators = await nodeOperatorRegistry.getOperatorInfos(true, false);
                expect(operators.length).eq(3);

                // set operator 3 delegation to false
                const validatorShareOperator3: ValidatorShareMock =
                    (await ethers.getContractAt(
                        "ValidatorShareMock",
                        operators[2].validatorShare
                    )) as ValidatorShareMock;
                await validatorShareOperator3.updateDelegation(false);

                operators = await nodeOperatorRegistry.getOperatorInfos(true, false);
                expect(operators.length).eq(2);

                // set operator 3 delegation to true
                await validatorShareOperator3.updateDelegation(true);
                operators = await nodeOperatorRegistry.getOperatorInfos(true, false);
                expect(operators.length).eq(3);
            });

            it("success getOperatorInfos validator ACTIVE + EJECTED + JAILED", async function () {
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeOperator(2, user2, user2Address, "100", "20");
                await stakeOperator(3, user3, user3Address, "100", "20");

                await stakeManagerMock.unstake(3);
                await checkOperator(1, { status: 1 }); // ACTIVE
                await checkOperator(2, { status: 1 }); // ACTIVE
                await checkOperator(3, { status: 7 }); // EJECTED
                let operators = await nodeOperatorRegistry.getOperatorInfos(false, false);

                expect(operators.length).eq(2);
                operators.forEach((op, index: number) => {
                    expect(op.operatorId).eq(index + 1);
                });

                operators = await nodeOperatorRegistry.getOperatorInfos(false, true);
                expect(operators.length).eq(3);

                await stakeManagerMock.slash(2);
                operators = await nodeOperatorRegistry.getOperatorInfos(false, true);
                expect(operators.length).eq(3);

                operators = await nodeOperatorRegistry.getOperatorInfos(false, false);
                expect(operators.length).eq(1);
            });

            it("success getOperatorInfos with active delegation", async function () {
                // If the rewards accumulated by a validator are not enough, the operator is ignored.
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeOperator(2, user2, user2Address, "100", "20");
                await stakeOperator(3, user3, user3Address, "100", "20");

                const op3 = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                    this,
                    3
                );
                const validatorShareOperator3: ValidatorShareMock =
                    (await ethers.getContractAt(
                        "ValidatorShareMock",
                        op3.validatorShare
                    )) as ValidatorShareMock;
                await validatorShareOperator3.setMinAmount(
                    ethers.utils.parseEther("10000")
                );

                const operators = await nodeOperatorRegistry.getOperatorInfos(true, false);

                expect(operators.length).eq(3);
                operators.forEach((op, index: number) => {
                    expect(op.operatorId).eq(index + 1);
                });
            });

            // success getOperatorInfos when a validator was unstaked from stakeManager
            // but not yest syncd with nodeOperator contract
            it("success getOperatorInfos when a validator was unstaked from stakeManager", async function () {
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeOperator(2, user2, user2Address, "100", "20");
                await stakeOperator(3, user3, user3Address, "100", "20");

                await stakeManagerMock.unstake(3);
                const operators = await nodeOperatorRegistry.getOperatorInfos(false, false);

                expect(operators.length).eq(2);
                operators.forEach((op, index) => {
                    expect(op.operatorId).eq(index + 1);
                });
            });

            it("success getOperatorInfos", async function () {
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeOperator(2, user2, user2Address, "100", "20");
                await stakeOperator(3, user3, user3Address, "100", "20");

                let operators = await nodeOperatorRegistry.getOperatorInfos(false, false);
                for (let i = 0; i < operators.length; i++) {
                    const op = operators[i];
                    await checkOperator(i + 1, {
                        validatorShare: op.validatorShare,
                        maxDelegateLimit: op.maxDelegateLimit,
                        rewardAddress: op.rewardAddress
                    });
                }
                await stakeManagerMock.slash(1);
                await stakeManagerMock.slash(3);

                operators = await nodeOperatorRegistry.getOperatorInfos(false, false);

                expect(operators.length, "operators.length").eq(1);
                await checkOperator(2, {
                    validatorShare: operators[0].validatorShare,
                    maxDelegateLimit: operators[0].maxDelegateLimit,
                    rewardAddress: operators[0].rewardAddress
                });
            });

            it("getOperatorInfos", async function () {
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeOperator(2, user2, user2Address, "100", "20");
                await newOperator(3, user3Address);

                // get all active operators
                let res = await nodeOperatorRegistry.getOperatorInfos(false, false);
                expect(res.length, "get all active operators").eq(2);
                for (let i = 0; i < res.length; i++) {
                    expect(res[i].operatorId, "operatorId").eq(i + 1);
                }

                // unstake the 2rd operator
                await nodeOperatorRegistry.connect(user2)["unstake()"].call(this);

                res = await nodeOperatorRegistry.getOperatorInfos(false, false);
                expect(res.length, "unstake the 2rd operator").eq(1);
                for (let i = 0; i < res.length; i++) {
                    expect(res[i].operatorId, "operatorId").eq(i + 1);
                }

                // stop the 1st operator
                await nodeOperatorRegistry.stopOperator(1);

                res = await nodeOperatorRegistry.getOperatorInfos(false, false);
                expect(res.length, "stop the 1st operator").eq(0);
            });

            it("should check validator status is EJECTED when slashed or unstaked", async function () {
                await stakeOperator(1, user1, user1Address, "100", "20");
                await stakeManagerMock.slash(1);
                await stakeManagerMock.unstake(1);
                await checkOperator(1, { status: 7 });
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
                const no = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
                    this,
                    i + 1
                );
                const vpc1 = (await hardhat.ethers.getContractAt(
                    "ValidatorProxy",
                    no.validatorProxy
                )) as ValidatorProxy;
                expect(await vpc1.operator()).equal(nodeOperatorRegistry.address);
                expect(await vpc1.implementation()).equal(validator.address);
                expect(await vpc1.validatorFactory()).equal(validatorFactory.address);
            }
        });
    });

    describe("Validator factory", async function () {
        it("check validator factory", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");
            await stakeOperator(3, user3, user3Address, "10", "20");
            expect(await validatorFactory.validatorImplementation()).equal(
                validator.address
            );

            expect((await validatorFactory.getValidators()).length).eq(3);
        });
    });

    describe("Upgrade contracts", async function () {
        it("Success upgrade validator Proxy validator implementation", async function () {
            await stakeOperator(1, user1, user1Address, "10", "20");
            await stakeOperator(2, user2, user2Address, "10", "20");

            const ValidatorV2 = (await ethers.getContractFactory(
                "ValidatorV2"
            )) as ValidatorV2__factory;
            const validatorContractV2 = await ValidatorV2.deploy();

            await validatorFactory.setValidatorImplementation(
                validatorContractV2.address
            );
            const validatorProxies = await validatorFactory.getValidators();

            for (let i = 0; i < validatorProxies.length; i++) {
                const vp = (await hardhat.ethers.getContractAt(
                    "ValidatorProxy",
                    validatorProxies[i]
                )) as ValidatorProxy;
                expect(await vp.implementation()).equal(validatorContractV2.address);

                await signer.sendTransaction({
                    to: vp.address,
                    data: new ethers.utils.Interface(
                        ValidatorV2.interface.fragments
                    ).encodeFunctionData("setX", [i + 10])
                });

                const res = await signer.call({
                    to: vp.address,
                    data: new ethers.utils.Interface(
                        ValidatorV2.interface.fragments
                    ).encodeFunctionData("getX")
                });

                const x = new ethers.utils.Interface(
                    ValidatorV2.interface.fragments
                ).decodeFunctionResult("getX", res);
                expect(x[0], "X is not valid").to.equal(i + 10);
            }
        });

        it("Fail to upgrade validator factory validatorImplementation", async function () {
            // add a new node operator
            await newOperator(1, user1Address);
            const ValidatorV2 = (await ethers.getContractFactory(
                "ValidatorV2"
            )) as ValidatorV2__factory;
            const validatorContractV2 = await ValidatorV2.deploy();
            await validatorContractV2.deployed();
            await expect(
                validatorFactory
                    .connect(user1)
                    .setValidatorImplementation(validatorContractV2.address)
            ).revertedWith("Ownable: caller is not the owner");
        });

        it("Success upgrade validator factory", async function () {
            const validatorFactoryV2 = await ethers.getContractFactory(
                "ValidatorFactoryV2"
            );
            const validatorFactoryV2Contract = (await upgrades.upgradeProxy(
                validatorFactory,
                validatorFactoryV2
            )) as ValidatorFactoryV2;

            expect(validatorFactoryV2Contract.address).equal(
                validatorFactory.address
            );
            await validatorFactoryV2Contract.setX(10);
            expect(await validatorFactoryV2Contract.getX()).equal(10);
        });

        it("Success upgrade node operator registry", async function () {
            await stakeOperator(1, user1, user1Address, "100", "20");
            await stakeOperator(2, user2, user2Address, "100", "20");

            const NodeOperatorRegistryV2 = await ethers.getContractFactory(
                "NodeOperatorRegistryV2"
            );
            const NodeOperatorRegistryV2Contract = (await upgrades.upgradeProxy(
                nodeOperatorRegistry.address,
                NodeOperatorRegistryV2
            )) as NodeOperatorRegistryV2;

            expect(
                (await nodeOperatorRegistry.address) ===
          NodeOperatorRegistryV2Contract.address
            );
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
async function newOperator (
    _id: number,
    userAddress: string,
    signer?: SignerWithAddress
) {
    const { name, signerPubkey } = getValidatorFakeData();

    // add new node operator
    expect(
        await nodeOperatorRegistry.addOperator(name, userAddress, signerPubkey)
    )
        .to.emit(nodeOperatorRegistry, "AddOperator")
        .withArgs(_id);
    return { name, signerPubkey };
}

async function stakeOperator (
    this: any,
    id: number,
    user: Signer,
    address: string,
    amount: string,
    heimdallFees: string
) {
    await newOperator(id, address);

    // get node operator
    const no1 = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
        this,
        id
    );

    const total = String(Number(amount) + Number(heimdallFees));
    // approve token to validator contract
    await polygonERC20.connect(user).approve(no1.validatorProxy, toEth(total));

    // stake a node operator
    expect(
        await nodeOperatorRegistry
            .connect(user)
            .stake(toEth(amount), toEth(heimdallFees))
    )
        .to.emit(nodeOperatorRegistry, "StakeOperator")
        .withArgs(id, toEth(amount), toEth(heimdallFees));
}

// convert a string to ether
function toEth (amount: string): BigNumber {
    return ethers.utils.parseEther(amount);
}

async function checkStats (
    totalNodeOperator: number,
    totalInactiveNodeOperator: number,
    totalActiveNodeOperator: number,
    totalStoppedNodeOperator: number,
    totalUnstakedNodeOperator: number,
    totalClaimedNodeOperator: number,
    totalExitNodeOperator: number,
    totalSlashedNodeOperator: number,
    totalEjectedNodeOperator: number
) {
    const stats = await nodeOperatorRegistry.getState();
    expect(stats[0].toNumber(), "totalNodeOperator").equal(totalNodeOperator);
    expect(stats[1].toNumber(), "totalInactiveNodeOperator").equal(
        totalInactiveNodeOperator
    );
    expect(stats[2].toNumber(), "totalActiveNodeOperator").equal(
        totalActiveNodeOperator
    );
    expect(stats[3].toNumber(), "totalStoppedNodeOperator").equal(
        totalStoppedNodeOperator
    );
    expect(stats[4].toNumber(), "totalUnstakedNodeOperator").equal(
        totalUnstakedNodeOperator
    );
    expect(stats[5].toNumber(), "totalClaimedNodeOperator").equal(
        totalClaimedNodeOperator
    );
    expect(stats[6].toNumber(), "totalExitNodeOperator").equal(
        totalExitNodeOperator
    );
    expect(stats[7].toNumber(), "totalSlashedNodeOperator").equal(
        totalSlashedNodeOperator
    );
    expect(stats[8].toNumber(), "totalSlashedNodeOperator").equal(
        totalEjectedNodeOperator
    );
}

async function checkOperator (
    this: any,
    id: number,
    no: {
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
    maxDelegateLimit?: BigNumber;
  }
) {
    const res = await nodeOperatorRegistry["getNodeOperator(uint256)"].call(
        this,
        id
    );

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
    if (no.maxDelegateLimit) {
        expect(res.maxDelegateLimit, "maxDelegateLimit").equal(no.maxDelegateLimit);
    }
}
