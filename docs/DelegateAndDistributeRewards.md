# Delegation and Rewards Distribution
Rewards are accumulated on the validators and the delegator, so the distribution is done by combining both.

The rewards accumulated are distributed to all the actors(users, validators, DAO).
Validators and DAO will get their rewards transferred automatically. But for the users, we don't send them the tokens because this process will consume many fees. Each user will have a staked balance and a reward balance, which is calculated using the total rewards and the total staked.

# Withdrawal Mechanism
When a new user delegates a certain amount of MATIC, he will be added to the public array of all delegators. He will be also assigned an ID. ID is an unsigned integer that gets incremented every time a new user delegates. There will be a mapping that maps the user address to a specific ID. There is also a public array that contains accumulated user rewards. Element of an array indexed by users ID is the amount of reward claimable by the user.

Each day claimable user rewards will be updated off-chain by doing a cron job, Gelato, etc. Firstly, all delegators will be fetched from a public array of delegators.  We need to know the current claimable reward for each delegator and we can get that from the second public array that is responsible for claimable rewards. A new array will be created by summing the old array and a new one that is created by distributing a new reward-based on delegators' stake ratio. Once the calculation is complete, this new merged array will be sent as an argument to Lido smart contract function that updates public claimable rewards by delegators.