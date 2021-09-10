# Operator contract
The Operator contract handles the following parts:
1. Openzeppelin ACL.
2. Manage validators.
3. Manage fees.

## Openzeppelin ACL
The operator manages the different permissions using the Openzepplin ACL contract.
### Roles:
1. VALIDATOR_OWNER
2. ADD_OPERATOR
3. SET_FEES
## Manage validators
The operator contract allows managing the validator contracts deployed by the validatorFactory.

### Add a new operator
**Step 1:**
- A new Operator expresses their interest to join the Lido Matic system.
- The DAO votes to include the new operator. After successful voting for inclusion, the Node Operator becomes active:
    1. A new validator contract is created.
    2. Set the status to NotStaked.

**step 2:** Stake an operator
- The operator calls stake function, including the amount of MATICs and heimdallFees.
- The operator is switched to staked status and becomes ready to accept delegation.

## Manage fees
- Set the reward distribution fees.

## Validator contract
The validator contract is used to stake on the polygon stake manager.
Each validator has:
- Proxy pattern
- Owned by the operator contract.
- Implement validatorManager API:
    1. **stakeFor:** stake a validator [link](https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/stakeManager/StakeManager.sol#L446).
    2. **unstake:** unstake a validator [link](https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/stakeManager/StakeManager.sol#L411).
    3. **topUpForFee:** topUpHeimdallFees for a validator [link](https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/stakeManager/StakeManager.sol#L334).
    4. **validatorStake:** get the total staked by a validator [link](https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/stakeManager/StakeManager.sol#L146).
    5. **getValidatorContract:** get validator share contract [link](https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/stakeManager/StakeManager.sol#L488).
    6. **withdrawRewards:** withdraw rewards [link](https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/stakeManager/StakeManager.sol#L516)

## Validator Factory
Using a factory pattern allows deploying a new validator automatically.