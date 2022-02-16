import hardhat, { ethers, upgrades } from "hardhat";
import {
    ValidatorFactory__factory
} from "../typechain";
import { exportAddresses, getUpgradeContext } from "./utils";

const upgradeValidatorFactory = async () => {
    const { network, filePath, deployDetails } = getUpgradeContext(hardhat);

    console.log("Start upgrade contracts on:", network);
    const validatorFactoryAddress = deployDetails.validator_factory_proxy;
    const validatorFactoryFactory: ValidatorFactory__factory = (
        await ethers.getContractFactory("ValidatorFactory")) as ValidatorFactory__factory;

    await upgrades.upgradeProxy(validatorFactoryAddress, validatorFactoryFactory);
    const validatorFactoryImplAddress = await upgrades.erc1967.getImplementationAddress(
        validatorFactoryAddress
    );

    console.log("ValidatorFactory upgraded");
    console.log("proxy:", validatorFactoryAddress);
    console.log("Implementation:", validatorFactoryImplAddress);

    exportAddresses(filePath, {
        validator_factory_proxy: validatorFactoryAddress,
        validator_factory_implementation: validatorFactoryImplAddress
    });
};

upgradeValidatorFactory();
