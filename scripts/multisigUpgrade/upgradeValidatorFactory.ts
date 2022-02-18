import hardhat from "hardhat";
import { getUpgradeContext } from "../utils";
import { createUpgradeProposal } from "./upgradeUtils";

const upgradeValidatorFactory = () => {
    const { deployDetails } = getUpgradeContext(hardhat);
    createUpgradeProposal(deployDetails.validator_factory_proxy, "ValidatorFactory");
};

upgradeValidatorFactory();
