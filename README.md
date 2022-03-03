# PoLido
Before deploying check out the `.env.example` and `.env.test.example` files. You should create your own `.env` (if you plan to deploy to mainnet) and `.env.test` (if you plan to deploy to testnet) files.
```bash
DEPLOYER_PRIVATE_KEY=<PRIVATE KEY OF THE DEPLOYER WALLET>
ETHERSCAN_API_KEY=<ETHERSCAN API KEY>
CHILD_CHAIN_RPC=<RPC OF THE CHILD CHAIN>
ROOT_CHAIN_RPC=<RPC OF THE ROOTH CHAIN>
ROOT_GAS_PRICE=<GAS PRICE ON THE ROOT CHAIN>
ROOT_GAS_LIMIT=<GAS LIMIT ON THE ROOT CHAIN>
CHILD_GAS_PRICE=<GAS PRICE ON THE CHILD CHAIN>
CHILD_GAS_LIMIT=<GAS LIMIT ON THE CHILD CHAIN>
CHECKPOINT_MANAGER=<CHECKPOINT MANAGER ADDRESS>
STAKE_MANAGER=<STAKE MANAGER ADDRESS>
MATIC_TOKEN=<ADDRESS OF THE MATIC ERC20 TOKEN>
FX_ROOT=<ADDRESS OF THE FX ROOT CONTRACT>
FX_CHILD=<ADDRESS OF THE FX CHILD CONTRACT>
DAO=<ADDRESS THAT WILL BE USED AS A DAO ON STMATIC>
INSURANCE=<ADDRESS THAT WILL BE USED AS AN INSURANCE ON STMATIC>
TREASURY=<ADDRESS THAT WILL BE USED AS A TREASURY ON STMATIC>
STMATIC_SUBMIT_THRESHOLD=<SUBMIT THRESHOLD>
```
# Deploying
To deploy on testnet run:
```bash
npm run deploy:test
```

To deploy on mainnet run:
```bash
npm run deploy:main
```

Verify contracts with:
`make verify-goerli`

# Testing
To execute tests run:
```bash
npx hardhat test
```

# Current deployed contract addresses
- [Goerli](https://github.com/Shard-Labs/PoLido/blob/main/testnet-deployment-info.json)
- [Mainnet](https://github.com/Shard-Labs/PoLido/blob/main/mainnet-deployment-info.json)

# Guide on executing tasks

To add a new operator run:
`npx hardhat addOperator --network <network> --operator-name <operatorName> --reward-address <rewardAddress> --pub-key <pubKey> --private-key <privateKey>`
OPTIONAL PARAMS: pub-key, private-key.
If you don't provide pub-key, it will be generated from VALIDATOR_PRIVATE_KEY from .env.
If you don't provide private key, tx will be signed with a wallet whose private key responds to GOERLI_PRIVATE_KEY from .env.
For now, the only supported <network> is goerli.

To stake an operator run:
`npx hardhat stakeOperator --network <network> --amount <amount> --heimdall-fee <heimdallFee> --private-key <privateKey>`
OPTIONAL PARAMS: private-key.
If you don't provide private key, tx will be signed with a wallet whose private key responds to GOERLI_PRIVATE_KEY from .env.
For now, the only supported <network> is goerli.
