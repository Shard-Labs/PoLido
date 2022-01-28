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

# Current deployed contract addresses on Goerli

MATIC_ERC20
`0x499d11E0b6eAC7c0593d8Fb292DCBbF815Fb29Ae`

MATIC_STAKE_MANAGER_PROXY
`0x00200eA4Ee292E253E6Ca07dBA5EdC07c8Aa37A3`

LIDO_NFT_PROXY
`0xb7f0F701473458549768753F3176411105ec9693`

LIDO_NFT_IMPLEMENTATION
`0x3b5A3946725d49B319A58722c592cc90875219A2`

StMATIC_PROXY
`0x9A7c69A167160C507602ecB3Df4911e8E98e1279`

stMATIC_implementation
`0x3563D6DC45c98FfA5b2a64C048C202a65895DCE6`

VALIDATOR_FACTORY_PROXY
`0x392C87754B73CC3A68059803D37D0387f16c8D81`

VALIDATOR_FACTORY_IMPLEMENTATION
`0x0117a088127a9Cd1f2629FD09cbB2842abA180F6`

NODE_OPERATOR_REGISTRY_PROXY
`0xb1f3f45360Cf0A30793e38C18dfefCD0d5136f9a`

NODE_OPERATOR_REGISTRY_PROXY_IMPLEMENTATION
`0x922b32A82265e6BCDf35e26a228979F008A54e05`

FX_STATE_ROOT_TUNNEL
`0x5C0e4a60Cb0cC9271994d834510e196e3985b616`

FX_STATE_CHILD_TUNNER
`0x2071947Fa4f823b7F9B21C78B0afD5EfFc2D968e`

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
