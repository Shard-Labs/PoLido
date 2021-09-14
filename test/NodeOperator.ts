import hre from "hardhat";
import { Artifact, } from "hardhat/types";
import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import chai, { expect } from 'chai';
import { solidity } from "ethereum-waffle";
import { NodeOperatorRegistry } from '../typechain/NodeOperatorRegistry';

chai.use(solidity);

const { deployContract } = hre.waffle;

describe('NodeOperator', function () {
    let signer: Signer;
    let user1: Signer;
    let NodeOperatorRegistryContract: NodeOperatorRegistry;

    beforeEach(async function () {
        const accounts = await ethers.getSigners();
        signer = accounts[0]
        user1 = accounts[1]

        // deploy node operator contract
        const NodeOperatorRegistryArtifact: Artifact = await hre.artifacts.readArtifact("NodeOperatorRegistry");
        NodeOperatorRegistryContract = <NodeOperatorRegistry>await deployContract(signer, NodeOperatorRegistryArtifact);
        await NodeOperatorRegistryContract.initialize()
    });

    it('add new operator fails permission missing', async function () {
        let name: string = "node 1";
        let rewardAddress: string = await user1.getAddress()
        let signerPubkey: string = ethers.utils.hexZeroPad("0x01", 64);

        // change the caller with a user that has no permission.
        await expect(NodeOperatorRegistryContract.connect(user1).addOperator(
            name,
            rewardAddress,
            signerPubkey
        )).to.revertedWith("Permission not found");
    })

    it('add new operator success', async function () {
        let name: string = "node 1";
        let rewardAddress: string = await user1.getAddress()
        let signerPubkey: string = ethers.utils.hexZeroPad("0x01", 64);

        // add new node operator
        const res = await NodeOperatorRegistryContract.addOperator(
            name,
            rewardAddress,
            signerPubkey
        );
        expect(res).to.emit(NodeOperatorRegistryContract, "NewOperator").withArgs(
            1, name, signerPubkey, 0
        )      

        // check node operator stats
        const stats = await NodeOperatorRegistryContract.nodeOperatorRegistryStats();
        // totalNodeOpearator = 1
        expect(stats[0].toNumber(), "totalNodeOpearator not match").equal(1);
        // totalActiveNodeOpearator =1
        expect(stats[1].toNumber(), "totalActiveNodeOpearator not match").equal(1);
    });
});