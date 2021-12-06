# PoLido

Deploy contracts with:
`make deploy-goerli`

Verify contracts with:
`make verify-goerli`

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
