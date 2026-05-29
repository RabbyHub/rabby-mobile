import React, { useCallback, useEffect, useMemo } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import {
  apiSendToken,
  SendTokenEvents,
  subscribeEvent,
  useSendTokenCanSubmit,
  useSendTokenFormValuesSelector,
  useSendTokenInternalShallowSelector,
  useSendTokenScreenChainToken,
  useSendTokenScreenStateShallowSelector,
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
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_WITH_ICON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';

function BottomArea() {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const canSubmit = useSendTokenCanSubmit();
  const to = useSendTokenFormValuesSelector(values => values.to);

  const {
    addressToAddAsContacts,
    agreeRequiredForToAddress,
    agreeRequiredForToken,
    buildTxsCount,
    isSubmitLoading,
  } = useSendTokenScreenStateShallowSelector(state => ({
    addressToAddAsContacts: state.addressToAddAsContacts,
    agreeRequiredForToAddress: state.agreeRequiredChecks.forToAddress,
    agreeRequiredForToken: state.agreeRequiredChecks.forToken,
    buildTxsCount: state.buildTxsCount,
    isSubmitLoading: state.isSubmitLoading,
  }));

  const {
    account,
    canShowDirectSign,
    directSignBtnRef,
    disableItemCheck,
    fetchContactAccounts,
    formValuesRef,
    fromAddress,
    handleIgnoreGasFeeChange,
    onBottomAreaLayout,
    onGasInfoDebouncedLoaded,
    saveCurrentFormValuesSnapshot,
    sendTokenEvents,
    submitForm,
    toAddrCex,
    toAddressInContactBook,
    toAddressPositiveTips,
  } = useSendTokenInternalShallowSelector(ctx => ({
    account: ctx.computed.account,
    canShowDirectSign: ctx.computed.canDirectSign,
    directSignBtnRef: ctx.directSignBtnRef,
    disableItemCheck: ctx.fns.disableItemCheck,
    fetchContactAccounts: ctx.fns.fetchContactAccounts,
    formValuesRef: ctx.formValuesRef,
    fromAddress: ctx.computed.fromAddress,
    handleIgnoreGasFeeChange: ctx.callbacks.handleIgnoreGasFeeChange,
    onBottomAreaLayout: ctx.callbacks.onBottomAreaLayout,
    onGasInfoDebouncedLoaded: ctx.callbacks.onGasInfoDebouncedLoaded,
    saveCurrentFormValuesSnapshot: ctx.callbacks.saveCurrentFormValuesSnapshot,
    sendTokenEvents: ctx.sendTokenEvents,
    submitForm: ctx.callbacks.submitForm,
    toAddrCex: ctx.computed.toAddrCex,
    toAddressInContactBook: ctx.computed.toAddressInContactBook,
    toAddressPositiveTips: ctx.computed.toAddressPositiveTips,
  }));

  const { currentToken } = useSendTokenScreenChainToken();

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
            saveCurrentFormValuesSnapshot();
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
          height={BOTTOM_BUTTON_SINGLE_HEIGHT}
          titleStyle={BOTTOM_BUTTON_WITH_ICON_TITLE_STYLE}
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
          height={BOTTOM_BUTTON_SINGLE_HEIGHT}
          titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
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
  containerPt: BOTTOM_BUTTON_TOP_OFFSET,
  // height: 220,
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
        paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
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
