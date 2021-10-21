# PoLido

Deploy contracts with:
`npx hardhat run scripts/deploy.ts --network goerli`

Verify contracts with:
`npx hardhat run verifyLido --network goerli`

# Current deployed contract addresses on Goerli

MATIC_ERC20
`0x499d11E0b6eAC7c0593d8Fb292DCBbF815Fb29Ae`

MATIC_STAKE_MANAGER_PROXY
`0x00200eA4Ee292E253E6Ca07dBA5EdC07c8Aa37A3`

LIDO_MATIC_PROXY
`0x5255d1AaF74DdF8B18d26e94C3d9C310a713605E`

LIDO_MATIC_IMPLEMENTATION
`0x71CE12e2d9676e3f0A9263a25A2B586b742945b2`

VALIDATOR_FACTORY_PROXY
`0x778e7Afc101c7DC99f46f0CC4e686694392B3a0d`

VALIDATOR_FACTORY_IMPLEMENTATION
`0x39b3e54a0E565548454add2eF0BD55F7789223f3`

NODE_OPERATOR_REGISTRY_PROXY
`0xdaFdbbe656E78c1c0CE7b71B61955988cBBf2770`

NODE_OPERATOR_REGISTRY_PROXY_IMPLEMENTATION
`0x21154c14c6d527A2c2e3d9383f1178B3951e8197`

# Guide on executing tasks

To add a new operator run:
`npx hardhat addOperator --network <network> --operator-name <operatorName> --reward-address <rewardAddress> --pub-key <pubKey> --private-key <privateKey>`
OPTIONAL PARAMS: pub-key, private-key.
If you don't provide pub-key, it will be generated from GOERLI_PRIVATE_KEY from .env.
If you don't provide private key, tx will be signed with a wallet whose private key responds to GOERLI_PRIVATE_KEY from .env.
For now, the only supported <network> is goerli.

To stake a validator run:
`npx hardhat stakeValidator --network <network> --amount <amount> --heimdall-fee <heimdallFee> --private-key <privateKey>`
OPTIONAL PARAMS: private-key.
If you don't provide private key, tx will be signed with a wallet whose private key responds to GOERLI_PRIVATE_KEY from .env.
For now, the only supported <network> is goerli.
