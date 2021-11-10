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
        ).deploy(mockERC20.address)) as StakeManagerMock;
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
    });

    it("Should submit successfully", async () => {
        const testerERC20 = mockERC20.connect(testers[0]);
        await testerERC20.approve(
            lidoMatic.address,
            ethers.utils.parseEther("1")
        );

        const testerLidoMatic = lidoMatic.connect(testers[0]);
        await testerLidoMatic.submit(ethers.utils.parseEther("1"));

        const testerBalance = await lidoMatic.balanceOf(testers[0].address);
        expect(testerBalance.eq(ethers.utils.parseEther("1"))).to.be.true;
    });
});