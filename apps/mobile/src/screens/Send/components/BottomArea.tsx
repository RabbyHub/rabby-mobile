import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import {
  SendTokenEvents,
  subscribeEvent,
  useSendTokenFormik,
  useSendTokenInternalContext,
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

import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { Account } from '@/core/services/preference';
import { RiskType, sortRisksDesc, useRisks } from '@/components/SendLike/risk';
import { eventBus, EventBusListeners, EVENTS } from '@/utils/events';
import { useSignatureStore } from '@/components2024/MiniSignV2';
import { BottomRiskTip } from '@/components/SendLike/BottomRiskTip';

const isAndroid = Platform.OS === 'android';

export default function BottomArea({ account }: { account: Account | null }) {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

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
    callbacks: { handleIgnoreGasFeeChange },

    fns: { putScreenState, fetchContactAccounts, disableItemCheck },
  } = useSendTokenInternalContext();

  const { currentToken } = useSendTokenScreenChainToken();

  const { isSubmitLoading, addressToAddAsContacts } = screenState;

  const [isAllowTransferModalVisible, setIsAllowTransferModalVisible] =
    React.useState(false);

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPb: SIZES.containerPb,
  });

  const { status, ctx } = useSignatureStore();

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
    onLoadFinished: useCallback(
      ctx => {
        putScreenState(prev => ({
          ...prev,
          agreeRequiredChecks: {
            ...prev.agreeRequiredChecks,
            forToAddress: false,
          },
        }));
      },
      [putScreenState],
    ),
  });

  useEffect(() => {
    const onTxCompleted: EventBusListeners[typeof EVENTS.TX_COMPLETED] =
      txDetail => {
        fetchRisks();
        setTimeout(() => {
          fetchRisks();
        }, 5000);
      };
    eventBus.addListener(EVENTS.TX_COMPLETED, onTxCompleted);

    return () => {
      eventBus.removeListener(EVENTS.TX_COMPLETED, onTxCompleted);
    };
  }, [fetchRisks]);

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
      style={[styles.bottomDockArea, { paddingBottom: safeSizes.containerPb }]}>
      <BottomRiskTip
        loadingRisks={loadingRisks}
        mostImportantRisks={mostImportantRisks}
        agreeRequiredChecked={agreeRequiredChecked}
        onToggleAgreeRequiredChecked={() => {
          putScreenState(prev => {
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
          onPress={handleSubmit}
        />
      )}

      <ModalConfirmAllowTransfer
        toAddr={formValues.to}
        visible={isAllowTransferModalVisible}
        showAddToWhitelist={toAddressInContactBook}
        onFinished={() => {
          putScreenState?.({ temporaryGrant: true });
          setIsAllowTransferModalVisible(false);
        }}
        onCancel={() => {
          setIsAllowTransferModalVisible(false);
        }}
      />

      <ModalAddToContacts
        addrToAdd={addressToAddAsContacts || ''}
        onFinished={async result => {
          putScreenState({ addressToAddAsContacts: null });
          fetchContactAccounts();

          // trigger get balance of address
          apiBalance.getAddressBalance(result.contactAddrAdded, {
            force: true,
          });
        }}
        onCancel={() => {
          putScreenState({ addressToAddAsContacts: null });
        }}
      />
    </View>
  );
}

const SIZES = {
  containerPt: 16,
  containerPb: 0,
  height: 220,
  bottom: 48,
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    bottomDockArea: {
      bottom: SIZES.bottom,
      width: '100%',
      paddingHorizontal: 24,
      position: 'absolute',
      paddingTop: SIZES.containerPt,
      paddingBottom: SIZES.containerPb,
      // ...makeDevOnlyStyle({
      //   backgroundColor: 'blue',
      // }),
      // height: SIZES.height,
    },
  };
});
