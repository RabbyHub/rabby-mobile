export enum HistoryItemCateType {
  Send = 'send',
  Approve = 'approve',
  Recieve = 'receive',
  Revoke = 'revoke',
  Bridge = 'bridge',
  Swap = 'swap',
  Contract = 'contract',
  UnKnown = 'interaction',
  Cancel = 'cancel',
  Buy = 'buy',
  GAS_DEPOSIT = 'gas_deposit',
  GAS_WITHDRAW = 'gas_withdraw',
  GAS_RECEIVED = 'gas_received',
}

export enum CUSTOM_HISTORY_ACTION {
  LENDING = 'LENDING',
}

export enum CUSTOM_HISTORY_TITLE_TYPE {
  LENDING_WITHDRAW = 'LENDING_WITHDRAW', // withdraw from lending
  LENDING_REPAY = 'LENDING_REPAY', // repay loan
  LENDING_BORROW = 'LENDING_BORROW', // borrow from lending
  LENDING_SUPPLY = 'LENDING_SUPPLY', // supply to lending
  LENDING_ON_COLLATERAL = 'LENDING_ON_COLLATERAL', // on collateral
  LENDING_OFF_COLLATERAL = 'LENDING_OFF_COLLATERAL', // off collateral
  LENDING_MANAGE_EMODE = 'LENDING_MANAGE_EMODE', // manage E-Mode
  LENDING_MANAGE_EMODE_DISABLE = 'LENDING_MANAGE_EMODE_DISABLE', // disable E-Mode
  LENDING_DEBT_SWAP = 'LENDING_DEBT_SWAP', // debt swap
  LENDING_REPAY_WITH_COLLATERAL = 'LENDING_REPAY_WITH_COLLATERAL', // repay with collateral
}
