let gasAccountDepositFlowActive = false;

export const setGasAccountDepositFlowActive = (active: boolean) => {
  gasAccountDepositFlowActive = active;
};

export const isGasAccountDepositFlowActive = () => gasAccountDepositFlowActive;
