import type { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { normalizeTxParams } from '@/components/Approval/components/SignTx/util';
import { resolveStoredGasSelection } from '@/components2024/MiniSignV2/domain/gasSelection';
import type {
  GasSelectionOptions,
  SignerConfig,
} from '@/components2024/MiniSignV2/domain/types';
import { SignatureManager } from '@/components2024/MiniSignV2/state/SignatureManager';
import type { Account } from '@/core/startupServices/preference';
import { ensureWalletUnlockedForAction } from '@/utils/walletUnlock';
import { assertMemeTradeAccount } from './accountGuard';

const USER_CANCELLED = 'User cancelled';

export type HeadlessDirectSigner = {
  prefetch(txs: Tx[]): Promise<void>;
  openDirect(txs: Tx[]): Promise<string[]>;
  close(): void;
};

/**
 * Not added to the MiniSign registry on purpose: no portal UI and no direct-mode
 * transparent overlay, so several chains can sign concurrently (spec §5.1).
 * Requires isHideErrorUI, otherwise a failure would wait for an error UI that never renders.
 */
export const createHeadlessDirectSigner = ({
  account,
}: {
  account: Account;
}): HeadlessDirectSigner => {
  assertMemeTradeAccount(account);
  const instance = new SignatureManager();
  const config: SignerConfig = { account, autoUseGasFree: true };

  const gasSelectionOf = (tx: Tx): GasSelectionOptions => {
    const { isSwap, isBridge, isSend, isSpeedUp, isCancel } =
      normalizeTxParams(tx);
    return {
      flags: { isSwap, isBridge, isSend, isSpeedUp, isCancel },
      lastSelection: resolveStoredGasSelection({ gasLevel: 'normal' }),
    };
  };

  return {
    async prefetch(txs) {
      await instance.prefetch({
        txs,
        config,
        gasSelection: gasSelectionOf(txs[0]),
      });
    },
    async openDirect(txs) {
      if (!(await ensureWalletUnlockedForAction())) {
        throw USER_CANCELLED;
      }
      return instance.openDirect(
        {
          txs,
          config,
          enableSecurityEngine: false,
          gasSelection: gasSelectionOf(txs[0]),
        },
        { isHideErrorUI: true },
      );
    },
    close() {
      instance.close();
    },
  };
};
