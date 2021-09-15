import * as dotenv from 'dotenv';
import { task } from 'hardhat/config';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';

import { HardhatUserConfig } from 'hardhat/config';

dotenv.config({ path: __dirname + '/.env' });

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (args, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

const INFURA_API_KEY = process.env.INFURA_API_KEY;
const GOERLI_PRIVATE_KEY = process.env.GOERLI_PRIVATE_KEY;

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    solidity: '0.8.7',
    networks: {
        goerli: {
          url: `https://goerli.infura.io/v3/${INFURA_API_KEY}`,
          accounts: [`0x${GOERLI_PRIVATE_KEY}`],
        },
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v5",
    },
}

export default config;
