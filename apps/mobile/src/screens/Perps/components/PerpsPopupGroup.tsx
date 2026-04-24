import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMemoizedFn } from 'ahooks';
import { Account } from '@/core/services/preference';
import { apisPerps } from '@/core/apis';
import { usePerpsAccount } from '@/hooks/perps/usePerpsAccount';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { HYPE_SEND_ASSET_TOKEN_MAP } from '@/constant/perps';
import { PerpBridgeHistory } from './PerpsDepositPopup';
import { usePerpsPopupState } from '../hooks/usePerpsPopupState';
import { PerpsAccountSelectorPopup } from './PerpsAccountSelectorPopup';
import { PerpsAccountLogoutPopup } from './PerpsAccountLogoutPopup';
import { PerpsAgentsLimitModal } from './PerpsAgentsLimitModal';
import { PerpsGuidePopup } from './PerpsGuidePopup';
import { PerpsDepositPopup } from './PerpsDepositPopup';
import { PerpsWithdrawPopup } from './PerpsWithdrawPopup';
import { PerpsSpotSwapPopup } from './PerpsSpotSwapPopup';
import { PerpsRiskLevelPopup } from './PerpsPositionSection/PerpsRiskLevelPopup';
import { PerpsInvitePopup } from './PerpsInvitePopup';

export type RiskPopupData = {
  distanceLiquidation: number;
  isCross: boolean;
  direction: 'Long' | 'Short';
  currentPrice: number;
  pxDecimals: number;
  liquidationPrice: number;
};

type Props = {
  currentPerpsAccount: Account | null;
  onLogin: (account: Account) => Promise<void>;
  onLogout: () => void;
  onDeleteAgent: () => Promise<void>;
  onDeposit: (
    txs: Tx[],
    amount: string,
    cacheBridgeHistory?: PerpBridgeHistory,
    options?: { skipHistory?: boolean; isHypeDeposit?: boolean },
  ) => Promise<string | undefined>;
  onWithdraw: (
    amount: number | string,
    isHypeWithdraw: boolean,
    isUnifiedAccount: boolean,
    targetAsset: keyof typeof HYPE_SEND_ASSET_TOKEN_MAP,
  ) => Promise<boolean>;
  onSpotOrder: (...args: any[]) => any;
  onApproveStatus: (options?: { isHideToast?: boolean }) => Promise<void>;
  onSafeSetReference: () => Promise<void>;
  riskPopupData: RiskPopupData | null;
  onCloseRiskPopup: () => void;
  isShowInvite: boolean | undefined;
  setIsShowInvite: (v: boolean) => void;
};

const PerpsPopupGroupComponent: React.FC<Props> = ({
  currentPerpsAccount,
  onLogin,
  onLogout,
  onDeleteAgent,
  onDeposit,
  onWithdraw,
  onSpotOrder,
  onApproveStatus,
  onSafeSetReference,
  riskPopupData,
  onCloseRiskPopup,
  isShowInvite,
  setIsShowInvite,
}) => {
  const { t } = useTranslation();
  const { isUnifiedAccount } = usePerpsAccount();
  const [popupState, setPopupState] = usePerpsPopupState();

  const closeLogin = useMemoizedFn(() =>
    setPopupState(prev => ({ ...prev, isShowLoginPopup: false })),
  );
  const closeLogout = useMemoizedFn(() =>
    setPopupState(prev => ({ ...prev, isShowLogoutPopup: false })),
  );
  const closeDeleteAgent = useMemoizedFn(() =>
    setPopupState(prev => ({ ...prev, isShowDeleteAgentPopup: false })),
  );
  const confirmDeleteAgent = useMemoizedFn(() => {
    onDeleteAgent();
    closeDeleteAgent();
  });
  const closeGuide = useMemoizedFn(async () =>
    setPopupState(prev => ({ ...prev, isShowGuidePopup: false })),
  );
  const completeGuide = useMemoizedFn(() => {
    apisPerps.setHasDoneNewUserProcess(true);
    setPopupState(prev => ({ ...prev, isShowGuidePopup: false }));
  });
  const closeDeposit = useMemoizedFn(() =>
    setPopupState(prev => ({ ...prev, isShowDepositPopup: false })),
  );
  const handleDeposit = useMemoizedFn(
    async (
      txs: Tx[],
      amount: string,
      cacheBridgeHistory?: PerpBridgeHistory,
      options?: { skipHistory?: boolean; isHypeDeposit?: boolean },
    ) => {
      try {
        return await onDeposit(txs, amount, cacheBridgeHistory, options);
      } catch (e) {
        console.error(e);
      }
    },
  );
  const closeWithdraw = useMemoizedFn(() =>
    setPopupState(prev => ({ ...prev, isShowWithdrawPopup: false })),
  );
  const handleWithdraw = useMemoizedFn(
    async (
      amount: string,
      isHypeWithdraw: boolean,
      targetAsset: keyof typeof HYPE_SEND_ASSET_TOKEN_MAP,
    ) => {
      await onWithdraw(amount, isHypeWithdraw, isUnifiedAccount, targetAsset);
      closeWithdraw();
    },
  );
  const closeSwap = useMemoizedFn(() =>
    setPopupState(prev => ({ ...prev, isShowSwapPopup: false })),
  );
  const openDepositFromSwap = useMemoizedFn(() =>
    setPopupState(prev => ({ ...prev, isShowDepositPopup: true })),
  );
  const closeInvite = useMemoizedFn(() => setIsShowInvite(false));
  const handleInvite = useMemoizedFn(async () => {
    await onApproveStatus({ isHideToast: true });
    await onSafeSetReference();
    setIsShowInvite(false);
  });

  return (
    <>
      <PerpsAccountSelectorPopup
        visible={popupState.isShowLoginPopup}
        onClose={closeLogin}
        value={currentPerpsAccount}
        onChange={onLogin}
        title={t('page.perps.selectAccountTitle')}
      />
      <PerpsAccountLogoutPopup
        visible={popupState.isShowLogoutPopup}
        onClose={closeLogout}
        onLogout={onLogout}
        account={currentPerpsAccount}
      />
      <PerpsAgentsLimitModal
        visible={popupState.isShowDeleteAgentPopup}
        onCancel={closeDeleteAgent}
        onConfirm={confirmDeleteAgent}
      />
      <PerpsGuidePopup
        visible={popupState.isShowGuidePopup}
        onClose={closeGuide}
        onComplete={completeGuide}
      />
      <PerpsDepositPopup
        account={currentPerpsAccount}
        visible={popupState.isShowDepositPopup}
        onClose={closeDeposit}
        onDeposit={handleDeposit}
      />
      <PerpsWithdrawPopup
        visible={popupState.isShowWithdrawPopup}
        onWithdraw={handleWithdraw}
        onClose={closeWithdraw}
      />
      <PerpsSpotSwapPopup
        visible={popupState.isShowSwapPopup}
        onClose={closeSwap}
        onSpotOrder={onSpotOrder}
        onSwapSuccess={() => {
          // Balance refreshed via WebSocket subscription
        }}
        onDepositPress={openDepositFromSwap}
      />
      {riskPopupData && (
        <PerpsRiskLevelPopup
          isCross={riskPopupData.isCross}
          direction={riskPopupData.direction}
          visible={!!riskPopupData}
          pxDecimals={riskPopupData?.pxDecimals || 2}
          onClose={onCloseRiskPopup}
          distanceLiquidation={riskPopupData.distanceLiquidation}
          currentPrice={riskPopupData.currentPrice}
          liquidationPrice={riskPopupData.liquidationPrice}
        />
      )}
      <PerpsInvitePopup
        visible={isShowInvite}
        onClose={closeInvite}
        onInvite={handleInvite}
      />
    </>
  );
};

export const PerpsPopupGroup = React.memo(PerpsPopupGroupComponent);
