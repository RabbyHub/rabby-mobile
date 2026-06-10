import { HyperliquidSDK } from '@rabby-wallet/hyperliquid-sdk';
import { perpsService } from '../services';
import { withWalletUnlock } from '@/utils/walletUnlockGuard';

let sdkInstance: HyperliquidSDK | null = null;
let currentMasterAddress: string | null = null;

class ApisPerps {
  getPerpsSDK() {
    if (!sdkInstance) {
      sdkInstance = new HyperliquidSDK({
        isTestnet: false,
        timeout: 10000,
      });
      return sdkInstance;
    }

    return sdkInstance;
  }

  destroyPerpsSDK() {
    sdkInstance?.ws.disconnect();
    sdkInstance = null;
    currentMasterAddress = null;
  }

  createPerpsAgentWallet = withWalletUnlock(async (masterWallet: string) => {
    return perpsService.createAgentWallet(masterWallet);
  });
  setPerpsCurrentAccount = perpsService.setCurrentAccount;
  getPerpsCurrentAccount = perpsService.getCurrentAccount;
  getPerpsLastUsedAccount = perpsService.getLastUsedAccount;
  getAgentWalletPreference = async (masterWallet: string) => {
    return perpsService.getAgentWalletPreference(masterWallet);
  };
  getPerpsAgentAddress = async (masterWallet: string) => {
    return perpsService.getAgentWalletPreference(masterWallet)?.agentAddress;
  };
  updatePerpsAgentWalletPreference = perpsService.updateAgentWalletPreference;
  setSendApproveAfterDeposit = perpsService.setSendApproveAfterDeposit;
  getSendApproveAfterDeposit = async (masterAddress: string) => {
    return perpsService.getSendApproveAfterDeposit(masterAddress);
  };
  setHasDoneNewUserProcess = perpsService.setHasDoneNewUserProcess;
  getHasDoneNewUserProcess = perpsService.getHasDoneNewUserProcess;
  setHasShownPerpsGuidePopup = perpsService.setHasShownPerpsGuidePopup;
  getHasShownPerpsGuidePopup = perpsService.getHasShownPerpsGuidePopup;
  setHasClosedLearnMoreCard = perpsService.setHasClosedLearnMoreCard;
  getHasClosedLearnMoreCard = perpsService.getHasClosedLearnMoreCard;
  setSelectedKlineInterval = perpsService.setSelectedKlineInterval;
  getSelectedKlineInterval = perpsService.getSelectedKlineInterval;
  getPerpsAgentWallet = withWalletUnlock(async (masterWallet: string) => {
    return perpsService.getAgentWallet(masterWallet);
  });
  getOrCreatePerpsAgentWallet = withWalletUnlock(
    async (masterWallet: string) => {
      const res = await perpsService.getAgentWallet(masterWallet);
      if (!res) {
        const resp = await perpsService.createAgentWallet(masterWallet);
        return {
          vault: resp.vault,
          agentAddress: resp.agentAddress,
          isCreate: true,
        };
      } else {
        return {
          vault: res.vault,
          agentAddress: res.preference.agentAddress,
          isCreate: false,
        };
      }
    },
  );
}

export const apisPerps = new ApisPerps();
