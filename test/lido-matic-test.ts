import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import * as IERC20JSON from '../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json';
import { LidoMatic__factory, LidoMatic, IERC20 } from '../typechain';
import { expect } from 'chai';
import { GoerliOverrides } from '../scripts/constants';

describe('LidoMatic', () => {
    let deployer: SignerWithAddress;
    let lidoMatic: LidoMatic;
    let TSTToken: IERC20;

    const TST = '0x7af963cF6D228E564e2A0aA0DdBF06210B38615D';

    before(async () => {
        [deployer] = await ethers.getSigners();

        TSTToken = new ethers.Contract(TST, IERC20JSON.abi, deployer) as IERC20;
    });

    beforeEach(async () => {
        const LidoMatic = (await ethers.getContractFactory(
            'LidoMatic'
        )) as LidoMatic__factory;

        lidoMatic = await LidoMatic.deploy(GoerliOverrides);
        await lidoMatic.deployed();

        console.log(`LidoMatic deployed at: ${lidoMatic.address}`);
    });

    it('should mint equal amount of tokens submitted', async function () {
        const stMATIC = new ethers.Contract(
            lidoMatic.address,
            IERC20JSON.abi,
            deployer
        ) as IERC20;
        const tokenAmount = ethers.utils.parseEther('0.1');

        await TSTToken.approve(lidoMatic.address, tokenAmount, GoerliOverrides);

        await lidoMatic.buyVoucher(tokenAmount, GoerliOverrides);

        const shares = await stMATIC.balanceOf(deployer.address);

        expect(shares.eq(tokenAmount));
    });
});
