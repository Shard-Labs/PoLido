import { ethers, upgrades } from 'hardhat';
import * as GOERLI_DEPLOYMENT_DETAILS from '../deploy-goerli.json';

const main = async () => {
    const lidoMaticAddress = GOERLI_DEPLOYMENT_DETAILS.stMATIC_proxy;
    const StMATIC = await ethers.getContractFactory('StMATIC');
    const stMATIC = await upgrades.upgradeProxy(lidoMaticAddress, StMATIC);

    console.log('StMATIC upgraded');
    console.log(stMATIC.address);
};

main();
