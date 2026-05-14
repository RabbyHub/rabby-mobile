import { apisPerps } from '@/core/apis/perps';
import {
  perpsStore,
  setAccountNeedApproveAgent,
} from '@/hooks/perps/usePerpsStore';
import { showToast } from '@/hooks/perps/showToast';

// Returns true when the error came from an expired agent. Side-effect: toast +
// flips `accountNeedApproveAgent`. Callers should treat true as "stop retrying".
export const judgeIsUserAgentIsExpired = async (
  errorMessage: string,
): Promise<boolean> => {
  const masterAddress = perpsStore.getState().currentPerpsAccount?.address;
  if (!masterAddress) {
    return false;
  }

  const agentWalletPreference = await apisPerps.getAgentWalletPreference(
    masterAddress,
  );
  const agentAddress = agentWalletPreference?.agentAddress;
  if (agentAddress && errorMessage.includes(agentAddress)) {
    console.warn('handle action agent is expired, logout');
    showToast('Agent is expired, please try again', 'error');
    setAccountNeedApproveAgent(true);
    return true;
  }
  return false;
};
