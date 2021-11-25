import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
    LidoMatic,
    LidoNFT,
    NodeOperatorRegistry,
    Polygon,
    StakeManagerMock,
    Validator,
    ValidatorFactory
} from "../typechain";

describe("Starting to test LidoMatic contract", () => {
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
        signerPubKey: string
    ) => Promise<void>;

    let stakeOperator: (
        id: BigNumberish,
        owner: SignerWithAddress,
        maxDelegation?: string
    ) => Promise<void>;

    before(() => {
        increaseBlockTime = async (amountInSeconds) => {
            const currentBlockNumber = await ethers.provider.getBlockNumber();
            const { timestamp } = await ethers.provider.getBlock(
                currentBlockNumber
            );
            await ethers.provider.send("evm_mine", [
                amountInSeconds + timestamp
            ]);
        };

        addOperator = async (name, rewardAddress, signerPubKey) => {
            await nodeOperatorRegistry.addOperator(
                name,
                rewardAddress,
                signerPubKey
            );
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
            const no1 = await nodeOperatorRegistry["getNodeOperator(address)"](
                signer.address
            );
            // approve token to validator contract
            await mockERC20
                .connect(signer)
                .approve(no1.validatorProxy, ethers.utils.parseEther("100"));

            // stake a node operator
            await nodeOperatorRegistry
                .connect(signer)
                .stake(
                    ethers.utils.parseEther("80"),
                    ethers.utils.parseEther("20")
                );
            await nodeOperatorRegistry.setDefaultMaxDelegateLimit(
                ethers.utils.parseEther("10000000000")
            );
            await nodeOperatorRegistry.setMaxDelegateLimit(
                id,
                ethers.utils.parseEther(maxDelegation || "0")
            );
        };
    });

    beforeEach(async () => {
        [deployer, ...testers] = await ethers.getSigners();

        mockERC20 = (await (
            await ethers.getContractFactory("Polygon")
        ).deploy()) as Polygon;
        await mockERC20.deployed();

        lidoNFT = (await upgrades.deployProxy(
            await ethers.getContractFactory("LidoNFT"),
            ["LidoNFT", "LN"]
        )) as LidoNFT;
        await lidoNFT.deployed();

        await mockERC20.transfer(
            testers[0].address,
            ethers.utils.parseEther("5")
        );

        mockStakeManager = (await (
            await ethers.getContractFactory("StakeManagerMock")
        ).deploy(mockERC20.address, lidoNFT.address)) as StakeManagerMock;
        await mockStakeManager.deployed();

        validator = (await (
            await ethers.getContractFactory("Validator")
        ).deploy()) as Validator;
        await validator.deployed();

        validatorFactory = (await upgrades.deployProxy(
            await ethers.getContractFactory("ValidatorFactory"),
            [validator.address]
        )) as ValidatorFactory;
        await validatorFactory.deployed();

        nodeOperatorRegistry = (await upgrades.deployProxy(
            await ethers.getContractFactory("NodeOperatorRegistry"),
            [
                validatorFactory.address,
                mockStakeManager.address,
                mockERC20.address
            ]
        )) as NodeOperatorRegistry;
        await nodeOperatorRegistry.deployed();

        lidoMatic = (await upgrades.deployProxy(
            await ethers.getContractFactory("LidoMatic"),
            [
                nodeOperatorRegistry.address,
                mockERC20.address,
                deployer.address,
                deployer.address,
                mockStakeManager.address,
                lidoNFT.address
            ]
        )) as LidoMatic;
        await lidoMatic.deployed();

        await lidoNFT.setLido(lidoMatic.address);
    });

    it("Should submit successfully", async () => {
        const amount = ethers.utils.parseEther("1");
        await submit(testers[0], amount);

        const testerBalance = await lidoMatic.balanceOf(testers[0].address);
        expect(testerBalance.eq(amount)).to.be.true;
    });

    it("Should request withdraw from the contract successfully", async () => {
        const amount = ethers.utils.parseEther("1");
        await submit(testers[0], amount);
        await requestWithdraw(testers[0], amount);
        const owned = await lidoNFT.getOwnedTokens(testers[0].address);
        expect(owned).length(1);
    });

    it("Should claim tokens successfully", async () => {
        const amount = ethers.utils.parseEther("1");
        await submit(testers[0], amount);
        await requestWithdraw(testers[0], amount);
        const owned = await lidoNFT.getOwnedTokens(testers[0].address);

        const withdrawalDelay = await mockStakeManager.withdrawalDelay();
        await increaseBlockTime(withdrawalDelay.toNumber());

        await claimTokens(testers[0], owned[0]);
    });

    it("Should pause the contract successfully", async () => {
        await lidoMatic.togglePause();
        await expect(lidoMatic.delegate()).to.be.revertedWith("Pausable: paused");
    });
});
