export type OperatorArgs = {
  operatorName: string;
  rewardAddress: string;
  pubKey?: string;
  privateKey?: string;
};

interface Multisig {
  address: string,
  owners: Array<string>
}

export interface DeployDetails {
  network: string;
  signer: string;
  multisig_upgrader :Multisig;
  dao: string;
  treasury: string;
  matic_erc20_address: string;
  matic_stake_manager_proxy: string;
  lido_nft_proxy: string;
  lido_nft_implementation: string;
  stMATIC_proxy: string;
  stMATIC_implementation: string;
  validator_factory_proxy: string;
  validator_factory_implementation: string;
  node_operator_registry_proxy: string;
  node_operator_registry_implementation: string;
  validator_implementation: string;
  fx_state_root_tunnel: string;
  fx_state_child_tunnel: string;
  default?: string;
}
