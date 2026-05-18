import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import {
  apiSendToken,
  SendTokenEvents,
  subscribeEvent,
  useSendTokenFormik,
  useSendTokenInternalContext,
  useSendTokenScreenChainToken,
} from '../hooks/useSendToken';
import { createGetStyles2024 } from '@/utils/styles';
import { ModalConfirmAllowTransfer } from '@/components/Address/SheetModalConfirmAllowTransfer';
import { ModalAddToContacts } from '@/components/Address/SheetModalAddToContacts';
import { apiBalance } from '@/core/apis';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { Button } from '@/components2024/Button';
import { useTranslation } from 'react-i18next';

import {
  DirectSignBtn,
  DirectSignBtnMethods,
} from '@/components2024/DirectSignBtn';
import { Account } from '@/core/services/preference';
import { RiskType, sortRisksDesc, useRisks } from '@/components/SendLike/risk';
import { useSignatureStore } from '@/components2024/MiniSignV2/state/useSignatureStore';
import { BottomRiskTip } from '@/components/SendLike/BottomRiskTip';
import { resolveBgColorByType } from '@/components2024/ScreenContainer/LinearGradientContainer';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { E2E_ID } from '@/constant/e2e';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { Text } from '@/components/Typography';
import { isGasAccountDepositFlowActive } from '@/screens/GasAccount/utils/depositFlowRuntime';

export default function BottomArea({ account }: { account: Account | null }) {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { safeOffBottom } = useSafeSizes();

  const { handleSubmit } = useSendTokenFormik();

  const {
    formValues,
    screenState,
    computed: {
      fromAddress,
      canSubmit,
      canDirectSign: canShowDirectSign,
      toAddressPositiveTips,
      toAddressInContactBook,
      toAddrCex,
    },
    directSignBtnRef,
    formValuesRef,
    sendTokenEvents,
    callbacks: {
      handleIgnoreGasFeeChange,
      onBottomAreaLayout,
      onGasInfoDebouncedLoaded,
    },

    fns: { fetchContactAccounts, disableItemCheck },
  } = useSendTokenInternalContext();

  const { currentToken } = useSendTokenScreenChainToken();

  const { isSubmitLoading, addressToAddAsContacts } = screenState;

  const [isAllowTransferModalVisible, setIsAllowTransferModalVisible] =
    React.useState(false);

  const { status, ctx } = useSignatureStore();
  const [calcCount, setCalcCount] = useState(ctx?.txsCalc?.length);
  useEffect(() => {
    setCalcCount(ctx?.txsCalc?.length);
  }, [ctx?.txsCalc?.length]);
  const debouncedCalcCount = useDebouncedValue(calcCount, 300);
  useEffect(() => {
    if (!debouncedCalcCount) return;
    if (debouncedCalcCount > 0) {
      onGasInfoDebouncedLoaded();
    }
  }, [debouncedCalcCount, onGasInfoDebouncedLoaded]);

  const isDirectSigning = status === 'signing';

  const canDirectSign = !ctx?.disabledProcess;
  const showRiskTipsForMiniSign = !!ctx?.gasFeeTooHigh;

  const {
    loading: loadingRisks,
    risks,
    fetchRisks,
  } = useRisks({
    // balance: !!screenState.toAddrAccountInfo?.account?.balance,
    fromAddress: fromAddress,
    toAddress: formValues.to,
    cex: toAddrCex,
    forbiddenCheck: useMemo(() => {
      return {
        user_addr: fromAddress || '',
        to_addr: formValues.to || '',
        chain_id: currentToken?.chain || '',
        id: currentToken?.id || '',
      };
    }, [fromAddress, formValues.to, currentToken?.chain, currentToken?.id]),
    onLoadFinished: useCallback(ctx => {
      apiSendToken.putScreenState(prev => ({
        ...prev,
        agreeRequiredChecks: {
          ...prev.agreeRequiredChecks,
          forToAddress: false,
        },
      }));
    }, []),
  });

  useEffect(() => {
    const disposeRets = [] as Function[];
    subscribeEvent(
      sendTokenEvents,
      SendTokenEvents.ON_SIGNED_SUCCESS,
      () => {
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
      },
      { disposeRets },
    );

    return () => {
      disposeRets.forEach(dispose => dispose());
    };
  }, [fetchRisks, sendTokenEvents]);

  const { mostImportantRisks, hasRiskForToAddress, hasRiskForToken } =
    React.useMemo(() => {
      const ret = {
        risksForToAddress: [] as { value: string }[],
        risksForToken: [] as { value: string }[],
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

      if (!ret.risksForToAddress.length) {
        const disableCheck = currentToken
          ? disableItemCheck(currentToken)
          : null;

        if (disableCheck?.disable) {
          ret.risksForToken.push({ value: disableCheck.simpleReason });
        }
      }

      if (__DEV__) {
        if (ret.risksForToAddress.length && ret.risksForToken.length) {
          throw new Error(
            'Address risk and Token risk should not appear at the same time',
          );
        }
      }

      ret.mostImportantRisks = [
        ...ret.risksForToAddress,
        ...ret.risksForToken,
      ].slice(0, 1);

      return {
        mostImportantRisks: ret.mostImportantRisks,
        hasRiskForToAddress: !!ret.risksForToAddress.length,
        hasRiskForToken: !!ret.risksForToken.length,
      };
    }, [
      currentToken,
      risks,
      toAddressPositiveTips?.hasPositiveTips,
      disableItemCheck,
    ]);

  const agreeRequiredChecked =
    (hasRiskForToAddress && screenState.agreeRequiredChecks.forToAddress) ||
    (hasRiskForToken && screenState.agreeRequiredChecks.forToken);

  const disableSubmitDueToBasic =
    !canSubmit || (!!mostImportantRisks.length && !agreeRequiredChecked);

  return (
    <View
      onLayout={onBottomAreaLayout}
      style={[
        styles.bottomDockArea,
        { paddingBottom: SIZES.containerPb + safeOffBottom },
      ]}>
      <BottomRiskTip
        loadingRisks={loadingRisks}
        mostImportantRisks={mostImportantRisks}
        agreeRequiredChecked={agreeRequiredChecked}
        onToggleAgreeRequiredChecked={() => {
          apiSendToken.putScreenState(prev => {
            return {
              ...prev,
              agreeRequiredChecks: {
                ...prev.agreeRequiredChecks,
                ...(hasRiskForToAddress && {
                  forToAddress: !agreeRequiredChecked,
                }),
                ...(hasRiskForToken && {
                  forToken: !agreeRequiredChecked,
                }),
              },
            };
          });
        }}
      />
      {canShowDirectSign ? (
        <DirectSignBtn
          ref={directSignBtnRef}
          // refresh  risk check
          key={screenState?.buildTxsCount + ''}
          showTextOnLoading
          loadingType="circle"
          authTitle={t('page.whitelist.confirmPassword')}
          title={t('global.confirm')}
          onFinished={p => {
            handleIgnoreGasFeeChange(p?.ignoreGasFee || false);
            handleSubmit();
          }}
          onBeforeAuth={() => {
            // Disable input during authentication to prevent autofill
            // Save amount snapshot before authentication starts
            formValuesRef.current.save({
              amount: formValues.amount || '',
            });
          }}
          onCancel={() => {
            formValuesRef.current.clear();
          }}
          onAuthModalDismiss={() => {
            formValuesRef.current.clear();
          }}
          disabled={
            disableSubmitDueToBasic || !canDirectSign || isDirectSigning
          }
          loading={isSubmitLoading}
          type={'primary'}
          balanceIconSpacing
          syncUnlockTime
          account={account}
          showHardWalletProcess
          showRiskTips={showRiskTipsForMiniSign && canSubmit}
          {...makeTestIDProps(E2E_ID.send.confirmButton)}
        />
      ) : (
        <Button
          disabled={disableSubmitDueToBasic}
          type="primary"
          title={'Send'}
          loading={isSubmitLoading}
          onPress={() => handleSubmit()}
          {...makeTestIDProps(E2E_ID.send.confirmButton)}
        />
      )}

      <ModalConfirmAllowTransfer
        toAddr={formValues.to}
        visible={isAllowTransferModalVisible}
        showAddToWhitelist={toAddressInContactBook}
        onFinished={() => {
          apiSendToken.putScreenState({ temporaryGrant: true });
          setIsAllowTransferModalVisible(false);
        }}
        onCancel={() => {
          setIsAllowTransferModalVisible(false);
        }}
      />

      <ModalAddToContacts
        addrToAdd={addressToAddAsContacts || ''}
        onFinished={async result => {
          apiSendToken.putScreenState({ addressToAddAsContacts: null });
          fetchContactAccounts();

          // trigger get balance of address
          apiBalance.getAddressBalance(result.contactAddrAdded, {
            force: true,
          });
        }}
        onCancel={() => {
          apiSendToken.putScreenState({ addressToAddAsContacts: null });
        }}
      />
    </View>
  );
}

const SIZES = {
  containerPt: 16,
  containerPb: 24,
};

const getStyle = createGetStyles2024(({ isLight, colors, colors2024 }) => {
  return {
    bottomDockArea: {
      width: '100%',
      paddingHorizontal: 24,
      flexShrink: 0,
      paddingTop: SIZES.containerPt,
      backgroundColor: resolveBgColorByType('bg1', {
        isLight: isLight ?? true,
        colors,
        colors2024,
      }),
    },
  };
});
