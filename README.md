# PoLido

Deploy contracts with:
`npx hardhat run scripts/deploy.ts --network goerli`

Verify contracts with:
`npx hardhat run verifyLido --network goerli`

# Current deployed contract addresses on Goerli

MATIC_ERC20
`0x3f152B63Ec5CA5831061B2DccFb29a874C317502`

MATIC_STAKE_MANAGER_PROXY
`0x00200eA4Ee292E253E6Ca07dBA5EdC07c8Aa37A3`

LIDO_MATIC_PROXY
`0x0e98431df595d0Eba68a0C93B8DF3EEF42E3838e`

LIDO_MATIC_IMPLEMENTATION
`0x18ecE8543e1D5910334abdAF659c821B101234d3`

VALIDATOR_FACTORY_PROXY
`0xD05d8dC1A27d0F3CA893A969A1a929acd44cf9b6`

VALIDATOR_FACTORY_IMPLEMENTATION
`0xF3aFA38a0197e80D217d6327263f9D0990f6aE4A`

NODE_OPERATOR_REGISTRY_PROXY
`0xDD37de7DA31197F148d92985c4e74607Bf8A3AEd`

NODE_OPERATOR_REGISTRY_PROXY_IMPLEMENTATION
`0xa4290e3B57b09e678D2A10D4Db08ED0E27bF0E3E`

# Guide on executing tasks
To add a new operator run:
`npx hardhat addOperator --network <network> --operator-name <operatorName> --reward-address <rewardAddress> --pub-key <pubKey> --private-key <privateKey>`
OPTIONAL PARAMS:  pub-key, private-key.
If you don't provide pub-key, it will be generated from GOERLI_PRIVATE_KEY from .env.
If you don't provide private key, tx will be signed with a wallet whose private key responds to GOERLI_PRIVATE_KEY from .env.
For now, the only supported <network> is goerli.

To stake a validator run:
`npx hardhat stakeValidator --network <network> --amount <amount> --heimdall-fee <heimdallFee> --private-key <privateKey>`
OPTIONAL PARAMS: private-key.
If you don't provide private key, tx will be signed with a wallet whose private key responds to GOERLI_PRIVATE_KEY from .env.
For now, the only supported <network> is goerli.