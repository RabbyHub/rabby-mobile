import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import {
  apiSendToken,
  SendTokenEvents,
  subscribeEvent,
  useSendTokenInternalShallowSelector,
  useSendTokenScreenChainToken,
} from '../hooks/useSendToken';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';
import { ModalConfirmAllowTransfer } from '@/components/Address/SheetModalConfirmAllowTransfer';
import { ModalAddToContacts } from '@/components/Address/SheetModalAddToContacts';
import { apiBalance } from '@/core/apis';
import { useSafeAndroidBottomSizes, useSafeSizes } from '@/hooks/useAppLayout';
import { Button } from '@/components2024/Button';
import { useTranslation } from 'react-i18next';

import {
  DirectSignBtn,
  DirectSignBtnMethods,
} from '@/components2024/DirectSignBtn';
import { RiskType, sortRisksDesc, useRisks } from '@/components/SendLike/risk';
import { useSignatureStore } from '@/components2024/MiniSignV2/state/useSignatureStore';
import { BottomRiskTip } from '@/components/SendLike/BottomRiskTip';
import { resolveBgColorByType } from '@/components2024/ScreenContainer/LinearGradientContainer';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { E2E_ID } from '@/constant/e2e';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { Text } from '@/components/Typography';
import { isGasAccountDepositFlowActive } from '@/screens/GasAccount/utils/depositFlowRuntime';

const isAndroid = Platform.OS === 'android';

function BottomArea() {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const {
    addressToAddAsContacts,
    agreeRequiredForToAddress,
    agreeRequiredForToken,
    amount,
    account,
    buildTxsCount,
    canShowDirectSign,
    canSubmit,
    directSignBtnRef,
    disableItemCheck,
    fetchContactAccounts,
    formValuesRef,
    fromAddress,
    handleIgnoreGasFeeChange,
    isSubmitLoading,
    onBottomAreaLayout,
    onGasInfoDebouncedLoaded,
    sendTokenEvents,
    submitForm,
    to,
    toAddrCex,
    toAddressInContactBook,
    toAddressPositiveTips,
  } = useSendTokenInternalShallowSelector(ctx => ({
    addressToAddAsContacts: ctx.screenState.addressToAddAsContacts,
    agreeRequiredForToAddress: ctx.screenState.agreeRequiredChecks.forToAddress,
    agreeRequiredForToken: ctx.screenState.agreeRequiredChecks.forToken,
    amount: ctx.formValues.amount,
    account: ctx.computed.account,
    buildTxsCount: ctx.screenState.buildTxsCount,
    canShowDirectSign: ctx.computed.canDirectSign,
    canSubmit: ctx.computed.canSubmit,
    directSignBtnRef: ctx.directSignBtnRef,
    disableItemCheck: ctx.fns.disableItemCheck,
    fetchContactAccounts: ctx.fns.fetchContactAccounts,
    formValuesRef: ctx.formValuesRef,
    fromAddress: ctx.computed.fromAddress,
    handleIgnoreGasFeeChange: ctx.callbacks.handleIgnoreGasFeeChange,
    isSubmitLoading: ctx.screenState.isSubmitLoading,
    onBottomAreaLayout: ctx.callbacks.onBottomAreaLayout,
    onGasInfoDebouncedLoaded: ctx.callbacks.onGasInfoDebouncedLoaded,
    sendTokenEvents: ctx.sendTokenEvents,
    submitForm: ctx.callbacks.submitForm,
    to: ctx.formValues.to,
    toAddrCex: ctx.computed.toAddrCex,
    toAddressInContactBook: ctx.computed.toAddressInContactBook,
    toAddressPositiveTips: ctx.computed.toAddressPositiveTips,
  }));

  const { currentToken } = useSendTokenScreenChainToken();

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
    toAddress: to,
    cex: toAddrCex,
    forbiddenCheck: useMemo(() => {
      return {
        user_addr: fromAddress || '',
        to_addr: to || '',
        chain_id: currentToken?.chain || '',
        id: currentToken?.id || '',
      };
    }, [fromAddress, to, currentToken?.chain, currentToken?.id]),
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
    (hasRiskForToAddress && agreeRequiredForToAddress) ||
    (hasRiskForToken && agreeRequiredForToken);

  const disableSubmitDueToBasic =
    !canSubmit || (!!mostImportantRisks.length && !agreeRequiredChecked);

  return (
    <View onLayout={onBottomAreaLayout} style={[styles.bottomDockArea]}>
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
          key={buildTxsCount + ''}
          showTextOnLoading
          loadingType="circle"
          authTitle={t('page.whitelist.confirmPassword')}
          title={t('global.confirm')}
          onFinished={p => {
            handleIgnoreGasFeeChange(p?.ignoreGasFee || false);
            submitForm();
          }}
          onBeforeAuth={() => {
            // Disable input during authentication to prevent autofill
            // Save amount snapshot before authentication starts
            formValuesRef.current.save({
              amount: amount || '',
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
          onPress={submitForm}
          {...makeTestIDProps(E2E_ID.send.confirmButton)}
        />
      )}

      <ModalConfirmAllowTransfer
        toAddr={to}
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

export default React.memo(BottomArea);

const SIZES = {
  containerPt: 16,
  containerPb: 48,
  // height: 220,
  bottom: 48,
};

const getStyle = createGetStyles2024(
  ({ safeAreaInsets, isLight, colors, colors2024 }) => {
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
        // ...makeDevOnlyStyle({
        //   backgroundColor: 'blue',
        // }),
        // height: SIZES.height,
      },
    };
  },
);
