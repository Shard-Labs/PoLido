import hardhat, { ethers, upgrades } from 'hardhat';
import { Signer } from 'ethers';
import fs from 'fs';
import path from 'path';
import { Artifact } from "hardhat/types";
import {
  ValidatorFactory,
  ValidatorFactory__factory,
  NodeOperatorRegistry__factory,
  NodeOperatorRegistry
} from '../typechain';

const { deployContract } = hardhat.waffle;

async function main() {
  // get network
  const networkName: string = hardhat.network.name

  // get signer
  const accounts = await ethers.getSigners();
  let signer: Signer = accounts[0]
  let signerAddress = await signer.getAddress()
  
  let polygonStakeManager: string
  let maticERC20Address: string

  // parse config file
  const configData: string = fs.readFileSync(
    path.join(process.cwd(), "config.json"),
    "utf-8"
  )
  const config = JSON.parse(configData)

  if (networkName === "goerli" || networkName === "mainnet") {
    // matic token address
    maticERC20Address = config.networks[networkName].StakeManagerProxy
  
    // polygon stake manager address
    polygonStakeManager = config.networks[networkName].Token
  } else {
    // if the network is localhost, deploy mock for erc20 token and stakeManager
    // deploy ERC20 token
    const polygonERC20Artifact: Artifact = await hardhat.artifacts.readArtifact("Polygon");
    maticERC20Address = (await deployContract(signer, polygonERC20Artifact)).address

    // deploy stake manager mock
    const stakeManagerMockArtifact: Artifact = await hardhat.artifacts.readArtifact("StakeManagerMock");
    polygonStakeManager = (await deployContract(
        signer,
        stakeManagerMockArtifact,
        [maticERC20Address]
    )).address
  }

  // deploy validator implementation
  const validatorArtifact: Artifact = await hardhat.artifacts.readArtifact("Validator");
  const validatorContract: ValidatorFactory = (await deployContract(
    signer,
    validatorArtifact,
    []
  )) as ValidatorFactory

  // deploy validator factory
  const validatorFactoryArtifact: ValidatorFactory__factory =
    (await ethers.getContractFactory('ValidatorFactory')) as ValidatorFactory__factory

  const validatorFactoryContract: ValidatorFactory = (await upgrades.deployProxy(
    validatorFactoryArtifact,
    [validatorContract.address],
    { kind: 'uups' }
  )) as ValidatorFactory

  await validatorFactoryContract.deployed();

  //deploy node operator
  const nodeOperatorRegistryArtifact: NodeOperatorRegistry__factory = (
    await ethers.getContractFactory('NodeOperatorRegistry')
  ) as NodeOperatorRegistry__factory

  const nodeOperatorRegistryContract: NodeOperatorRegistry =
    (await upgrades.deployProxy(
      nodeOperatorRegistryArtifact,
      [
        validatorFactoryContract.address,
        polygonStakeManager,
        maticERC20Address
      ],
      { kind: 'uups' }
    )) as NodeOperatorRegistry

  await nodeOperatorRegistryContract.deployed();

  // deploy lido contract
  const LidoMatic = await ethers.getContractFactory('LidoMatic')
  const lidoMatic = await upgrades.deployProxy(LidoMatic, [
    nodeOperatorRegistryContract.address,
    maticERC20Address,
    config.dao,
  ]);

  await lidoMatic.deployed();

  // set operator address for the validator factory
  await validatorFactoryContract.setOperatorAddress(nodeOperatorRegistryContract.address)
  // set lido contract fot the operator
  await nodeOperatorRegistryContract.setLido(lidoMatic.address)

  // write addreses into json file
  const data = {
    network: networkName,
    signer: signerAddress,
    dao: config.dao,
    treasury: config.treasury,
    matic_erc20_address: maticERC20Address,
    matic_stake_manager_proxy: polygonStakeManager,
    lido_matic: lidoMatic.address,
    validator_implementation: validatorContract.address,
    validator_factory_proxy: validatorFactoryContract.address,
    node_operator_registry_proxy: nodeOperatorRegistryContract.address
  }

  fs.writeFileSync(
    path.join(process.cwd(), "deploy-" + networkName + ".json"),
    JSON.stringify(data, null, 4),
    "utf8"
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
