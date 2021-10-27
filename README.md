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
`0xEa8d63B27B1A2D2B34faa5D40b612dcaC6e586b8`

LIDO_NFT_IMPLEMENTATION
`0x1a023c32BeE49d52cfe2A2d55440506749ab08d4`

LIDO_MATIC_PROXY
`0xB68d001d705df795B89456E76255eE433A5ac989`

LIDO_MATIC_IMPLEMENTATION
`0x597D3E1E1194d630DA6D61d6f6C76CCAdDd2f13E`

VALIDATOR_FACTORY_PROXY
`0xf8268B614f45Ce66A80d038e01c4f052cF994904`

VALIDATOR_FACTORY_IMPLEMENTATION
`0x2933F6acbF9D2A5e25Ec6B967EDf7A84031dab7a`

NODE_OPERATOR_REGISTRY_PROXY
`0x6CFd21C4cD6b2430b7Dcf4Fa24EF3d60e8Dd9895`

NODE_OPERATOR_REGISTRY_PROXY_IMPLEMENTATION
`0x4FE766556830891D64211Ee34C92c22953bB8913`

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
