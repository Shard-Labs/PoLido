import hardhat, { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import fs from "fs";
import path from "path";
import { Artifact } from "hardhat/types";
import {
    ValidatorFactory,
    ValidatorFactory__factory,
    NodeOperatorRegistry__factory,
    NodeOperatorRegistry,
    LidoMatic__factory,
    LidoMatic
} from "../typechain";

const { deployContract } = hardhat.waffle;

async function main () {
    // get network
    const networkName: string = hardhat.network.name;

    // get signer
    const accounts = await ethers.getSigners();
    const signer: Signer = accounts[0];
    const signerAddress = await signer.getAddress();

    let polygonStakeManager: string;
    let maticERC20Address: string;

    // parse config file
    const configData: string = fs.readFileSync(
        path.join(process.cwd(), "config.json"),
        "utf-8"
    );
    const config = JSON.parse(configData);

    if (networkName === "goerli" || networkName === "mainnet") {
        // matic token address
        maticERC20Address = config.networks[networkName].Token;

        // polygon stake manager address
        polygonStakeManager = config.networks[networkName].StakeManagerProxy;
    } else {
        // if the network is localhost, deploy mock for erc20 token and stakeManager
        // deploy ERC20 token
        const polygonERC20Artifact: Artifact =
            await hardhat.artifacts.readArtifact("Polygon");
        maticERC20Address = (await deployContract(signer, polygonERC20Artifact))
            .address;
        console.log("polygonERC20 mock contract deployed");

        // deploy stake manager mock
        const stakeManagerMockArtifact: Artifact =
            await hardhat.artifacts.readArtifact("StakeManagerMock");
        polygonStakeManager = (
            await deployContract(signer, stakeManagerMockArtifact, [
                maticERC20Address
            ])
        ).address;
        console.log("polygonStakeManager mock contract deployed");
    }
    console.log("start deployment on:", networkName);

    // deploy validator implementation
    const validatorArtifact: Artifact = await hardhat.artifacts.readArtifact(
        "Validator"
    );
    const validatorContract: ValidatorFactory = (await deployContract(
        signer,
        validatorArtifact,
        []
    )) as ValidatorFactory;
    console.log("Validator contract deployed to:", validatorContract.address);

    // deploy validator factory
    const validatorFactoryArtifact: ValidatorFactory__factory =
        (await ethers.getContractFactory(
            "ValidatorFactory"
        )) as ValidatorFactory__factory;

    const validatorFactoryContract: ValidatorFactory =
        (await upgrades.deployProxy(validatorFactoryArtifact, [
            validatorContract.address
        ])) as ValidatorFactory;

    await validatorFactoryContract.deployed();
    const validatorFactoryImplAddress =
        await upgrades.erc1967.getImplementationAddress(
            validatorFactoryContract.address
        );

    console.log(
        "ValidatorFactory proxy contract deployed to:",
        validatorFactoryContract.address
    );
    console.log(
        "ValidatorFactory implementation contract deployed to:",
        validatorFactoryImplAddress
    );

    // deploy node operator
    const nodeOperatorRegistryArtifact: NodeOperatorRegistry__factory =
        (await ethers.getContractFactory(
            "NodeOperatorRegistry"
        )) as NodeOperatorRegistry__factory;

    const nodeOperatorRegistryContract: NodeOperatorRegistry =
        (await upgrades.deployProxy(nodeOperatorRegistryArtifact, [
            validatorFactoryContract.address,
            polygonStakeManager,
            maticERC20Address
        ])) as NodeOperatorRegistry;

    await nodeOperatorRegistryContract.deployed();
    const nodeOperatorRegistryContractImplAddress =
        await upgrades.erc1967.getImplementationAddress(
            nodeOperatorRegistryContract.address
        );

    console.log(
        "NodeOperatorRegistry contract deployed to:",
        nodeOperatorRegistryContract.address
    );
    console.log(
        "NodeOperatorRegistry implementation contract deployed to:",
        nodeOperatorRegistryContractImplAddress
    );

    // deploy lido contract
    const LidoMaticFactory: LidoMatic__factory =
        (await ethers.getContractFactory("LidoMatic")) as LidoMatic__factory;
    const lidoMatic: LidoMatic = (await upgrades.deployProxy(LidoMaticFactory, [
        nodeOperatorRegistryContract.address,
        maticERC20Address,
        config.dao,
        config.insurance
    ])) as LidoMatic;

    await lidoMatic.deployed();
    const lidoMaticImplAddress =
        await upgrades.erc1967.getImplementationAddress(lidoMatic.address);

    console.log("MaticLido contract deployed to:", lidoMatic.address);
    console.log(
        "MaticLido contract implementation deployed to:",
        lidoMaticImplAddress
    );

    // set operator address for the validator factory
    await validatorFactoryContract.setOperatorAddress(
        nodeOperatorRegistryContract.address
    );
    console.log("validatorFactory operator set");

    // set lido contract fot the operator
    await nodeOperatorRegistryContract.setLido(lidoMatic.address);
    console.log("NodeOperatorRegistry lido set");

    // write addreses into json file
    const data = {
        network: networkName,
        signer: signerAddress,
        dao: config.dao,
        treasury: config.treasury,
        matic_erc20_address: maticERC20Address,
        matic_stake_manager_proxy: polygonStakeManager,
        lido_matic: lidoMatic.address,
        lido_matic_implementation: lidoMaticImplAddress,
        validator_factory_proxy: validatorFactoryContract.address,
        validator_factory_implementation: validatorContract.address,
        node_operator_registry_proxy: nodeOperatorRegistryContract.address,
        node_operator_registry_implementation:
            nodeOperatorRegistryContractImplAddress
    };
    const filePath = path.join(
        process.cwd(),
        "deploy-" + networkName + ".json"
    );
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), "utf8");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
