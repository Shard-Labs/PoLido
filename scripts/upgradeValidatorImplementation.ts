import hardhat, { ethers } from "hardhat";
import {
    ValidatorFactory
} from "../typechain";
import { exportAddresses, getUpgradeContext } from "./utils";

const upgradeValidatorImplementation = async () => {
    const { network, filePath, deployDetails } = getUpgradeContext(hardhat);

    console.log("Start upgrade contracts on:", network);

    const validatorFactory = (await ethers.getContractAt("ValidatorFactory",
        deployDetails.validator_factory_proxy)
    ) as ValidatorFactory;

    const validator = await (await ethers.getContractFactory("Validator")).deploy();
    await validatorFactory.setValidatorImplementation(validator.address);

    console.log("update validator proxies implementation");
    console.log("Validator implementation deployed:", validator.address);

    exportAddresses(filePath, {
        validator_implementation: validator.address
    });
};

upgradeValidatorImplementation();
