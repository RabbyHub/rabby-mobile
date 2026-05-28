import React, { useCallback, useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';
import { Button } from '@/components2024/Button';
import {
  apiSendNFT,
  useSendNFTCanSubmit,
  useSendNFTFormValuesSelector,
  useSendNFTInternalShallowSelector,
  useSendNFTScreenStateShallowSelector,
} from '../hooks/useSendNFT';
import { useTranslation } from 'react-i18next';

import { ModalConfirmAllowTransfer } from '@/components/Address/SheetModalConfirmAllowTransfer';
import { ModalAddToContacts } from '@/components/Address/SheetModalAddToContacts';
import { apiBalance } from '@/core/apis';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useTheme2024 } from '@/hooks/theme';

import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useSignatureStore } from '@/components2024/MiniSignV2/state/useSignatureStore';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { RiskType, sortRisksDesc, useRisks } from '@/components/SendLike/risk';
import { eventBus, EventBusListeners, EVENTS } from '@/utils/events';
import { BottomRiskTip } from '@/components/SendLike/BottomRiskTip';
import { resolveBgColorByType } from '@/components2024/ScreenContainer/LinearGradientContainer';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { isGasAccountDepositFlowActive } from '@/screens/GasAccount/utils/depositFlowRuntime';

function BottomArea() {
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle: getStyles });
  const canSubmit = useSendNFTCanSubmit();
  const to = useSendNFTFormValuesSelector(values => values.to);

  const {
    addressToAddAsContacts,
    agreeRequiredForToAddress,
    buildTxsCount,
    isSubmitLoading,
  } = useSendNFTScreenStateShallowSelector(state => ({
    addressToAddAsContacts: state.addressToAddAsContacts,
    agreeRequiredForToAddress: state.agreeRequiredChecks.forToAddress,
    buildTxsCount: state.buildTxsCount,
    isSubmitLoading: state.isSubmitLoading,
  }));

  const {
    account,
    canShowDirectSign,
    fetchContactAccounts,
    fromAddress,
    handleIgnoreGasFeeChange,
    nftItem,
    onBottomAreaLayout,
    onGasInfoDebouncedLoaded,
    submitForm,
    toAddrCex,
    toAddressInContactBook,
    toAddressPositiveTips,
  } = useSendNFTInternalShallowSelector(ctx => ({
    account: ctx.computed.account,
    canShowDirectSign: ctx.computed.canDirectSign,
    fetchContactAccounts: ctx.fns.fetchContactAccounts,
    fromAddress: ctx.computed.fromAddress,
    handleIgnoreGasFeeChange: ctx.callbacks.handleIgnoreGasFeeChange,
    nftItem: ctx.computed.currentNFT,
    onBottomAreaLayout: ctx.callbacks.onBottomAreaLayout,
    onGasInfoDebouncedLoaded: ctx.callbacks.onGasInfoDebouncedLoaded,
    submitForm: ctx.callbacks.submitForm,
    toAddrCex: ctx.computed.toAddrCex,
    toAddressInContactBook: ctx.computed.toAddressInContactBook,
    toAddressPositiveTips: ctx.computed.toAddressPositiveTips,
  }));

  const [isAllowTransferModalVisible, setIsAllowTransferModalVisible] =
    React.useState(false);

  const signatureStatus = useSignatureStore(state => state.status);
  const signatureDisabledProcess = useSignatureStore(
    state => !!state.ctx?.disabledProcess,
  );
  const signatureGasFeeTooHigh = useSignatureStore(
    state => !!state.ctx?.gasFeeTooHigh,
  );
  const txsCalcLength = useSignatureStore(state => state.ctx?.txsCalc?.length);
  const debouncedCalcCount = useDebouncedValue(txsCalcLength, 300);
  useEffect(() => {
    if (!debouncedCalcCount) return;
    if (debouncedCalcCount > 0) {
      onGasInfoDebouncedLoaded();
    }
  }, [debouncedCalcCount, onGasInfoDebouncedLoaded]);

  const isDirectSigning = signatureStatus === 'signing';
  const canDirectSign = !signatureDisabledProcess;
  const showRiskTipsForMiniSign = signatureGasFeeTooHigh;

  const {
    loading: loadingRisks,
    risks: risks,
    fetchRisks,
  } = useRisks({
    // balance: !!screenState.toAddrAccountInfo?.account?.balance,
    fromAddress,
    toAddress: to,
    cex: toAddrCex,
    forbiddenCheck: useMemo(() => {
      return {
        user_addr: fromAddress || '',
        to_addr: to || '',
        chain_id: nftItem?.chain,
        // id: nftItem?.id || '',
        id: to || '',
      };
    }, [fromAddress, to, nftItem?.chain /* , nftItem?.id */]),
    onLoadFinished: useCallback(() => {
      apiSendNFT.putScreenState(prev => ({
        ...prev,
        agreeRequiredChecks: {
          ...prev.agreeRequiredChecks,
          forToAddress: false,
        },
      }));
    }, []),
  });

  useEffect(() => {
    const onTxCompleted: EventBusListeners[typeof EVENTS.TX_COMPLETED] =
      txDetail => {
        if (isGasAccountDepositFlowActive()) {
          return;
        }
        fetchRisks();
        setTimeout(() => {
          if (isGasAccountDepositFlowActive()) {
            return;
          }
          fetchRisks();
        }, 5000);
      };
    eventBus.addListener(EVENTS.TX_COMPLETED, onTxCompleted);

    return () => {
      eventBus.removeListener(EVENTS.TX_COMPLETED, onTxCompleted);
    };
  }, [fetchRisks]);

  const { mostImportantRisks, hasRiskForToAddress } = React.useMemo(() => {
    const ret = {
      risksForToAddress: [] as { value: string }[],
      mostImportantRisks: [] as { value: string }[],
    };
    if (risks.length) {
      const sorted = (
        !toAddressPositiveTips?.hasPositiveTips
          ? [...risks]
          : [...risks].filter(item => item.type !== RiskType.NEVER_SEND)
      ).sort(sortRisksDesc);

      ret.risksForToAddress = sorted
        .slice(0, 1)
        .map(item => ({ value: item.value }));
    }

    ret.mostImportantRisks = [...ret.risksForToAddress].slice(0, 1);

    return {
      mostImportantRisks: ret.mostImportantRisks,
      hasRiskForToAddress: !!ret.risksForToAddress.length,
    };
  }, [risks, toAddressPositiveTips?.hasPositiveTips]);

  const agreeRequiredChecked = hasRiskForToAddress && agreeRequiredForToAddress;

  const disableSubmitDueToBasic =
    !canSubmit || (!!mostImportantRisks.length && !agreeRequiredChecked);

  return (
    <View onLayout={onBottomAreaLayout} style={[styles.bottomDockArea]}>
      <BottomRiskTip
        loadingRisks={loadingRisks}
        mostImportantRisks={mostImportantRisks}
        agreeRequiredChecked={agreeRequiredChecked}
        onToggleAgreeRequiredChecked={() => {
          apiSendNFT.putScreenState(prev => {
            return {
              ...prev,
              agreeRequiredChecks: {
                ...prev.agreeRequiredChecks,
                ...(hasRiskForToAddress && {
                  forToAddress: !agreeRequiredChecked,
                }),
              },
            };
          });
        }}
      />
      {canShowDirectSign ? (
        <DirectSignBtn
          // refresh  risk check
          key={buildTxsCount + ''}
          showTextOnLoading
          loadingType="circle"
          authTitle={t('page.whitelist.confirmPassword')}
          title={t('global.confirm')}
          onFinished={p => {
            handleIgnoreGasFeeChange(p?.ignoreGasFee || false);
            submitForm();
          }}
          disabled={
            disableSubmitDueToBasic || !canDirectSign || isDirectSigning
          }
          loading={isSubmitLoading}
          type={'primary'}
          syncUnlockTime
          account={account}
          showHardWalletProcess
          showRiskTips={showRiskTipsForMiniSign && canSubmit}
        />
      ) : (
        <Button
          disabled={disableSubmitDueToBasic}
          type="primary"
          title={'Send'}
          loading={isSubmitLoading}
          onPress={submitForm}
        />
      )}

      <ModalConfirmAllowTransfer
        toAddr={to}
        visible={isAllowTransferModalVisible}
        showAddToWhitelist={toAddressInContactBook}
        onFinished={result => {
          apiSendNFT.putScreenState({ temporaryGrant: true });
          setIsAllowTransferModalVisible(false);
        }}
        onCancel={() => {
          setIsAllowTransferModalVisible(false);
        }}
      />

      <ModalAddToContacts
        addrToAdd={addressToAddAsContacts || ''}
        onFinished={async result => {
          apiSendNFT.putScreenState({ addressToAddAsContacts: null });
          fetchContactAccounts();

          // trigger get balance of address
          apiBalance.getAddressBalance(result.contactAddrAdded, {
            force: true,
          });
        }}
        onCancel={() => {
          apiSendNFT.putScreenState({ addressToAddAsContacts: null });
        }}
      />
    </View>
  );
}

export default React.memo(BottomArea);

export const SIZES = {
  containerPt: 16,
  containerPb: 48,
  // height: 308,
  bottom: 48,
};

const getStyles = createGetStyles2024(
  ({ colors2024, safeAreaInsets, isLight, colors }) => {
    return {
      bottomDockArea: {
        bottom: 0,
        width: '100%',
        paddingHorizontal: 24,
        position: 'absolute',
        paddingTop: SIZES.containerPt,
        paddingBottom: SIZES.containerPb + safeAreaInsets.bottom,
        backgroundColor: resolveBgColorByType('bg1', {
          isLight: isLight ?? true,
          colors,
          colors2024,
        }),
        // ...makeDebugBorder(),
      },
    };
  },
);
