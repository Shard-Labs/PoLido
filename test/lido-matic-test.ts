import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';
import {
    ERC20,
    IStakeManager,
    LidoMatic,
    LidoNFT,
    MockInsurance,
    NodeOperatorRegistry,
    StakeManagerMock,
    Validator,
    ValidatorFactory,
} from '../typechain';

describe('Starting to test LidoMatic contract', () => {
    let dao: SignerWithAddress;
    let deployer: SignerWithAddress;
    let lidoMatic: LidoMatic;
    let lidoNFT: LidoNFT;
    let validator: Validator;
    let validatorFactory: ValidatorFactory;
    let nodeOperatorRegistry: NodeOperatorRegistry;
    let mockInsurance: MockInsurance;
    let mockStakeManager: StakeManagerMock;
    let mockERC20: ERC20;

    beforeEach(async () => {
        [deployer, dao] = await ethers.getSigners();

        mockERC20 = (await (
            await ethers.getContractFactory('ERC20')
        ).deploy('Matic', 'MATIC')) as ERC20;
        await mockERC20.deployed();

        lidoNFT = (await upgrades.deployProxy(
            await ethers.getContractFactory('LidoNFT'),
            ['LidoNFT', 'LN']
        )) as LidoNFT;
        await lidoNFT.deployed();

        mockStakeManager = (await (
            await ethers.getContractFactory('StakeManagerMock')
        ).deploy(mockERC20.address)) as StakeManagerMock;
        await mockStakeManager.deployed();

        validator = (await (
            await ethers.getContractFactory('Validator')
        ).deploy()) as Validator;
        await validator.deployed();

        validatorFactory = (await upgrades.deployProxy(
            await ethers.getContractFactory('ValidatorFactory'),
            [validator.address]
        )) as ValidatorFactory;
        await validatorFactory.deployed();

        nodeOperatorRegistry = (await upgrades.deployProxy(
            await ethers.getContractFactory('NodeOperatorRegistry'),
            [
                validatorFactory.address,
                mockStakeManager.address,
                mockERC20.address,
            ]
        )) as NodeOperatorRegistry;
        await nodeOperatorRegistry.deployed();

        lidoMatic = (await upgrades.deployProxy(
            await ethers.getContractFactory('LidoMatic'),
            [
                nodeOperatorRegistry.address,
                mockERC20.address,
                dao.address,
                mockInsurance.address,
                mockStakeManager.address,
                lidoNFT.address,
            ]
        )) as LidoMatic;
        await lidoMatic.deployed();
    });
});
