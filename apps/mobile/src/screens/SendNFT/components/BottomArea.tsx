import React, { useCallback, useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';
import { Button } from '@/components2024/Button';
import {
  useSendNFTFormik,
  useSendNFTInternalContext,
} from '../hooks/useSendNFT';
import { useTranslation } from 'react-i18next';

import { ModalConfirmAllowTransfer } from '@/components/Address/SheetModalConfirmAllowTransfer';
import { ModalAddToContacts } from '@/components/Address/SheetModalAddToContacts';
import { apiBalance } from '@/core/apis';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useTheme2024 } from '@/hooks/theme';

import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useSignatureStore } from '@/components2024/MiniSignV2';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { Account } from '@/core/services/preference';
import { RiskType, sortRisksDesc, useRisks } from '@/components/SendLike/risk';
import { eventBus, EventBusListeners, EVENTS } from '@/utils/events';
import { BottomRiskTip } from '@/components/SendLike/BottomRiskTip';

export default function BottomArea({ account }: { account: Account | null }) {
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle: getStyles });

  const { handleSubmit } = useSendNFTFormik();

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
      currentNFT: nftItem,
    },
    callbacks: { handleIgnoreGasFeeChange },
    fns: { putScreenState, fetchContactAccounts },
  } = useSendNFTInternalContext();

  const { isSubmitLoading, addressToAddAsContacts } = screenState;

  const [isAllowTransferModalVisible, setIsAllowTransferModalVisible] =
    React.useState(false);

  const { status, ctx } = useSignatureStore();

  const isDirectSigning = status === 'signing';
  const canDirectSign = !ctx?.disabledProcess;
  const showRiskTipsForMiniSign = !!ctx?.gasFeeTooHigh;

  const {
    loading: loadingRisks,
    risks: risks,
    fetchRisks,
  } = useRisks({
    // balance: !!screenState.toAddrAccountInfo?.account?.balance,
    fromAddress,
    toAddress: formValues.to,
    cex: toAddrCex,
    forbiddenCheck: useMemo(() => {
      return {
        user_addr: fromAddress || '',
        to_addr: formValues.to || '',
        chain_id: nftItem?.chain,
        // id: nftItem?.id || '',
        id: formValues.to || '',
      };
    }, [fromAddress, formValues.to, nftItem?.chain /* , nftItem?.id */]),
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

  const agreeRequiredChecked =
    hasRiskForToAddress && screenState.agreeRequiredChecks.forToAddress;

  const disableSubmitDueToBasic =
    !canSubmit || (!!mostImportantRisks.length && !agreeRequiredChecked);

  return (
    <View style={[styles.bottomDockArea]}>
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
        onFinished={result => {
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

export const bottomAreaSizes = {
  containerPt: 16,
  containerPb: 48,
  height: 220,
  bottom: 0,
};

const getStyles = createGetStyles2024(({ colors2024, safeAreaInsets }) => {
  return {
    bottomDockArea: {
      bottom: bottomAreaSizes.bottom,
      width: '100%',
      paddingHorizontal: 24,
      position: 'absolute',
      paddingTop: bottomAreaSizes.containerPt,
      paddingBottom: bottomAreaSizes.containerPb + 20 + safeAreaInsets.bottom,
      backgroundColor: colors2024['neutral-bg-1'],
      // ...makeDebugBorder(),
    },
  };
});
