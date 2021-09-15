import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import * as IERC20JSON from '../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json';
import { LidoMatic__factory, LidoMatic, IERC20 } from '../typechain';
import { expect } from 'chai';
import { GoerliOverrides } from '../scripts/constants';
import { BigNumber } from 'ethers';

describe('LidoMatic', () => {
    let deployer: SignerWithAddress;
    let lidoMatic: LidoMatic;
    let TSTToken: IERC20;

    const TST = '0x7af963cF6D228E564e2A0aA0DdBF06210B38615D';

    before(async () => {
        const LidoMatic = (await ethers.getContractFactory(
            'LidoMatic'
        )) as LidoMatic__factory;

        [deployer] = await ethers.getSigners();
        TSTToken = new ethers.Contract(TST, IERC20JSON.abi, deployer) as IERC20;

        lidoMatic = await LidoMatic.deploy(GoerliOverrides);
        await lidoMatic.deployed();

        console.log(`LidoMatic deployed at: ${lidoMatic.address}`);
    });

    it('should mint equal amount of tokens submitted', async () => {
        const tokenAmount = ethers.utils.parseEther('0.1');

        const balanceOld = await lidoMatic.balanceOf(deployer.address);

        await TSTToken.approve(lidoMatic.address, tokenAmount, GoerliOverrides);

        await (await lidoMatic.buyVoucher(tokenAmount, GoerliOverrides)).wait();

        const balancenew = await lidoMatic.balanceOf(deployer.address);

        expect(balancenew.sub(balanceOld).eq(tokenAmount)).to.be.true;
    });

    it('should return equal amount of tokens that were withdrawn', async () => {
        const tokenAmount = ethers.utils.parseEther('0.1');

        const balanceOld = await TSTToken.balanceOf(deployer.address);

        await (
            await lidoMatic.sellVoucher(tokenAmount, GoerliOverrides)
        ).wait();

        const balanceNew = await TSTToken.balanceOf(deployer.address);

        expect(balanceNew.sub(balanceOld).eq(tokenAmount)).to.be.true;
    });
});
