import hardhat, { ethers, upgrades } from 'hardhat';
import * as GOERLI_DEPLOYMENT_DETAILS from '../deploy-goerli.json';

const main = async () => {
    console.log('deploy PoLidoNFT...');
    const PoLidoNFT = await ethers.getContractFactory('PoLidoNFT');
    const poLidoNFT = await upgrades.deployProxy(PoLidoNFT, ['PoLido', 'PLO']);
    await poLidoNFT.deployed();
    const lidoNFTImplAddress = await upgrades.erc1967.getImplementationAddress(
        poLidoNFT.address
    );
    console.log('PoLidoNFT Impl address:', lidoNFTImplAddress);
    console.log('PoLidoNFT Proxy address:', poLidoNFT.address);

    console.log('deploy StMATIC...');
    const StMATIC = await ethers.getContractFactory('StMATIC');
    const stMATIC = await upgrades.deployProxy(StMATIC, [
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy,
        GOERLI_DEPLOYMENT_DETAILS.matic_erc20_address,
        GOERLI_DEPLOYMENT_DETAILS.dao,
        GOERLI_DEPLOYMENT_DETAILS.dao,
        GOERLI_DEPLOYMENT_DETAILS.matic_stake_manager_proxy,
        poLidoNFT.address,
    ]);

    await poLidoNFT.setStMATIC(stMATIC.address);

    await stMATIC.deployed();
    const lidoMaticImplAddress =
        await upgrades.erc1967.getImplementationAddress(stMATIC.address);

    console.log('StMATIC Implementation address:', lidoMaticImplAddress);
    console.log('StMATIC Proxy address:', stMATIC.address);

    // Update nodeOperatorLido address
    const nodeOperatorLidoArtifact = await hardhat.artifacts.readArtifact(
        'NodeOperatorRegistry'
    );
    const nor = await ethers.getContractAt(
        nodeOperatorLidoArtifact.abi,
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy
    );
    await nor.setStMATIC(GOERLI_DEPLOYMENT_DETAILS.stMATIC_proxy);
};

main();
