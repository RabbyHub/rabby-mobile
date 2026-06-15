import { HyperliquidSDK } from '@rabby-wallet/hyperliquid-sdk';
import { perpsService } from '../services';
import { withWalletUnlock } from '@/utils/walletUnlockGuard';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { apisKeyring } from './keyring';
import { PERPS_AGENT_NAME } from '@/constant/perps';
import type { Account } from '../services/preference';

let sdkInstance: HyperliquidSDK | null = null;

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

  isSelfSignPerpsAccount = (type?: string) =>
    type === KEYRING_CLASS.PRIVATE_KEY || type === KEYRING_CLASS.MNEMONIC;

  /**
   * Bind the SDK to an agent-signed account. Always drops any externalSign
   * installed by a previous self-sign session first — sdk.initAccount alone
   * keeps it, and signL1Action prefers externalSign over the agent key, so a
   * leftover signer would sign the new account's actions with the old
   * account's key.
   */
  initPerpsAgentAccount = (
    masterAddress: string,
    vault: string | undefined,
    agentAddress: string,
    agentName: string = PERPS_AGENT_NAME,
  ) => {
    const sdk = this.getPerpsSDK();
    sdk.setExternalSign(undefined);
    sdk.initAccount(masterAddress, vault, agentAddress, agentName);
  };

  /**
   * Build the SDK externalSign callback for a self-sign account: signs
   * Hyperliquid L1 typed data (EIP-712 V4) with the account's OWN keyring key —
   * no agent wallet, no plaintext export. apisKeyring.signTypedData is wrapped
   * with withWalletUnlockIf, so wallet unlock is deferred to this signing
   * moment. Returns a 0x-prefixed hex signature (r+s+v) per the SDK's
   * ExternalSign contract.
   */
  private makePerpsExternalSign =
    (account: Account) =>
    async (typedData: any): Promise<string> =>
      apisKeyring.signTypedData(account.type, account.address, typedData, {
        version: 'V4',
      });

  // Configure the SDK's signing identity for an account. NO top-level
  // withWalletUnlock: self-sign just installs the signer (reads no key), staying
  // locked until an action is actually signed. The agent branch unlocks via
  // getOrCreatePerpsAgentWallet (withWalletUnlock), which decrypts/encrypts vault.
  applyPerpsSigner = async (account: Account) => {
    const sdk = this.getPerpsSDK();
    if (this.isSelfSignPerpsAccount(account.type)) {
      sdk.initAccount(
        account.address,
        undefined,
        account.address,
        PERPS_AGENT_NAME,
      );
      sdk.setExternalSign(this.makePerpsExternalSign(account));
      return {
        agentAddress: account.address,
        isSelfSign: true,
        isCreate: false,
      };
    }
    const { vault, agentAddress, isCreate } =
      await this.getOrCreatePerpsAgentWallet(account.address);
    this.initPerpsAgentAccount(account.address, vault, agentAddress);
    return { agentAddress, isSelfSign: false, isCreate };
  };
}

export const apisPerps = new ApisPerps();
