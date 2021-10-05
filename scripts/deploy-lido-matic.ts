// scripts/create-box.js
import { ethers, upgrades } from 'hardhat';

import { LidoMatic, LidoMatic__factory } from '../typechain';

const main = async () => {
    const LidoMatic: LidoMatic__factory = (await ethers.getContractFactory(
        'LidoMatic'
    )) as LidoMatic__factory;

    const lidoMatic: LidoMatic = (await upgrades.deployProxy(LidoMatic, [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
    ])) as LidoMatic;

    await lidoMatic.deployed();

    console.log('LidoMatic deployed to:', lidoMatic.address);
};

main();
