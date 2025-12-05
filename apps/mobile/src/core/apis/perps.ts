import { HyperliquidSDK } from '@rabby-wallet/hyperliquid-sdk';
import { perpsService } from '../services';

let sdkInstance: HyperliquidSDK | null = null;
let currentMasterAddress: string | null = null;

// interface InitPerpsSDKParams {
//   masterAddress: string;
//   agentPrivateKey: string;
//   agentPublicKey: string;
//   agentName: string;
// }

// export const initPerpsSDK = (params: InitPerpsSDKParams) => {
//   const { masterAddress, agentPrivateKey, agentPublicKey, agentName } = params;
//   if (
//     sdkInstance &&
//     currentMasterAddress &&
//     currentMasterAddress.toLowerCase() === masterAddress.toLowerCase()
//   ) {
//     (window as any).__HyperliquidSDK = sdkInstance;
//     return sdkInstance;
//   }

//   if (sdkInstance) {
//     sdkInstance.ws?.disconnect();
//   }

//   sdkInstance = new HyperliquidSDK({
//     masterAddress,
//     agentPrivateKey,
//     agentPublicKey,
//     agentName,
//   });
//   // connect when subscribe
//   // sdkInstance.ws.connect();
//   currentMasterAddress = masterAddress;
//   (window as any).__HyperliquidSDK = sdkInstance;
//   return sdkInstance;
// };

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

  // destroyPerpsSDK() {
  //   sdkInstance?.ws.disconnect();
  //   sdkInstance = null;
  //   currentMasterAddress = null;
  // }

  createPerpsAgentWallet = async (masterWallet: string) => {
    return perpsService.createAgentWallet(masterWallet);
  };
  setPerpsCurrentAccount = perpsService.setCurrentAccount;
  getPerpsCurrentAccount = perpsService.getCurrentAccount;
  getPerpsLastUsedAccount = perpsService.getLastUsedAccount;
  getAgentWalletPreference = async (masterWallet: string) => {
    return perpsService.getAgentWalletPreference(masterWallet);
  };
  updatePerpsAgentWalletPreference = perpsService.updateAgentWalletPreference;
  setSendApproveAfterDeposit = perpsService.setSendApproveAfterDeposit;
  getSendApproveAfterDeposit = async (masterAddress: string) => {
    return perpsService.getSendApproveAfterDeposit(masterAddress);
  };
  setHasDoneNewUserProcess = perpsService.setHasDoneNewUserProcess;
  getHasDoneNewUserProcess = perpsService.getHasDoneNewUserProcess;
  getPerpsAgentWallet = async (masterWallet: string) => {
    return perpsService.getAgentWallet(masterWallet);
  };
  getOrCreatePerpsAgentWallet = async (masterWallet: string) => {
    const res = await perpsService.getAgentWallet(masterWallet);
    if (!res) {
      const resp = await this.createPerpsAgentWallet(masterWallet);
      return {
        vault: resp.vault,
        agentAddress: resp.agentAddress,
      };
    } else {
      return {
        vault: res.vault,
        agentAddress: res.preference.agentAddress,
      };
    }
  };
}

export const apisPerps = new ApisPerps();
