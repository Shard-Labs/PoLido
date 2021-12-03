# Lido contract

The Lido contract handles the following parts:

1. Openzeppelin ACL.
2. Non-rebasable ERC20 token.
3. Reward Distribution.
4. Manage withdrawals.
5. Receive token submits.
6. Delegate to validators.

## Openzeppelin ACL

The poLido manages the different permissions using the Openzepplin ACL contract.

### Roles:

1. PAUSE.
2. UNPAUSE.

## Non-rebasable ERC20 token

The stMatic token never changes from the user perspective, it can update only when submitting more tokens or request withdrawal.

## Reward Distribution

The Lido contract is responsible to distribute rewards to all the actors.

## Manage withdrawals

The Lido contract manage the user withdrawal requests and the claims [here](User.md)

## Receive token submits

The Lido contract is the entry point for the users to submit Matics and get stMatic.

## Delegate to validators

The Matic poLido contract is used to delegate tokens to validators.
It implements validatorShare API:

1. **BuyVoucher:** buy shares from a validator [link](https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/validatorShare/ValidatorShare.sol#L112).
2. **sellVoucher_new:** sell an amount of shares [link](https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/validatorShare/ValidatorShare.sol#L238). Also, it has a good feature that allows us to track each sell request using a nonce.
3. **unstakeClaimTokens_new:** claim the token by a nonce [link](https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/validatorShare/ValidatorShare.sol#L254).
4. **getTotalStake:** get the total staked amount [link](https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/validatorShare/ValidatorShare.sol#L77).
5. **getLiquidRewards:** get the accumulated rewards [link](https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/validatorShare/ValidatorShare.sol#L100)

## Stats

1. Total Delegated.
2. Buffered tokens.
