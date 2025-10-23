import React, { useEffect, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import {
  useSendTokenFormik,
  useSendTokenInternalContext,
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
  directSigningAtom,
  useCanProcessDirectSubmit,
  useMiniDirectSignGasFeeTooHigh,
} from '@/hooks/useMiniApprovalDirectSign';
import { useAtomValue } from 'jotai';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { Account } from '@/core/services/preference';
import { RiskType, useRisks } from './ConfirmAddress/risk';
import { RcIconWarningCircleCC } from '@/assets2024/icons/common';
import { Skeleton } from '@rneui/themed';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { useCreationWithDeepCompare } from '@/hooks/common/useMemozied';

const isAndroid = Platform.OS === 'android';

const riskTypePriority = {
  [RiskType.CEX_NO_DEPOSIT]: 1,
  [RiskType.NEVER_SEND]: 11,
  [RiskType.CONTRACT_ADDRESS]: 111,
  [RiskType.SCAM_ADDRESS]: 1111,
};

function sortRisksDesc(a: { type: RiskType }, b: { type: RiskType }) {
  return (
    riskTypePriority[b.type as keyof typeof riskTypePriority] -
    riskTypePriority[a.type as keyof typeof riskTypePriority]
  );
}

export default function BottomArea({ account }: { account: Account | null }) {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { handleSubmit } = useSendTokenFormik();

  const {
    formValues,
    screenState,
    computed: {
      canSubmit,
      canDirectSign: canShowDirectSign,
      toAddressInContactBook,
      toAddrCex,
    },

    fns: { putScreenState, fetchContactAccounts },
  } = useSendTokenInternalContext();

  const { isSubmitLoading, addressToAddAsContacts } = screenState;

  const [isAllowTransferModalVisible, setIsAllowTransferModalVisible] =
    React.useState(false);

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPb: SIZES.containerPb,
  });

  const isDirectSigning = useAtomValue(directSigningAtom);

  const canDirectSign = useCanProcessDirectSubmit();

  const showRiskTipsForMiniSign = useMiniDirectSignGasFeeTooHigh();

  const {
    loading: loadingRisks,
    risks,
    addressDesc,
  } = useRisks(
    formValues.to,
    !!screenState.toAddrAccountInfo?.account?.balance,
    toAddrCex,
  );

  const stableRisks = useCreationWithDeepCompare(() => risks, [risks]);
  useEffect(() => {
    stableRisks;
    if (loadingRisks) {
      putScreenState({ agreeCheckedOrNoRisk: false });
    }
  }, [stableRisks, loadingRisks, putScreenState]);

  const mostImportantRisks = React.useMemo(() => {
    if (risks.length === 0) {
      return [];
    }
    const sorted = [...risks].sort(sortRisksDesc);
    return sorted.slice(0, 1);
  }, [risks]);

  const disableSubmitDueToBasic =
    !canSubmit || !screenState.agreeCheckedOrNoRisk;

  return (
    <View
      style={[styles.bottomDockArea, { paddingBottom: safeSizes.containerPb }]}>
      <View style={styles.riskTipsArea}>
        <View style={[styles.riskList]}>
          {loadingRisks ? (
            <View style={styles.tipItem}>
              <Skeleton circle width={20} height={20} />
              <Skeleton style={styles.loadingRisks} height={40} />
            </View>
          ) : (
            mostImportantRisks.map(risk => (
              <View key={risk.type} style={styles.tipItem}>
                <RcIconWarningCircleCC
                  width={20}
                  height={20}
                  color={colors2024['red-default']}
                />
                <Text style={styles.tipText}>{risk.value}</Text>
              </View>
            ))
          )}
        </View>
        {!loadingRisks && mostImportantRisks?.length ? (
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => {
              putScreenState({
                agreeCheckedOrNoRisk: !screenState.agreeCheckedOrNoRisk,
              });
            }}>
            <CheckBoxRect
              size={16}
              checked={screenState.agreeCheckedOrNoRisk}
            />
            <Text style={styles.checkboxText}>
              {t('page.confirmAddress.checkbox')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {canShowDirectSign ? (
        <DirectSignBtn
          // refresh  risk check
          key={screenState?.buildTxsCount + ''}
          showTextOnLoading
          loadingType="circle"
          authTitle={t('page.whitelist.confirmPassword')}
          title={t('global.confirm')}
          onFinished={handleSubmit}
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
  containerPb: 26,
  height: 220,
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    bottomDockArea: {
      bottom: 0,
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

    riskTipsArea: {
      // ...makeDebugBorder(),
      marginBottom: 12,
    },

    riskList: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      // backgroundColor: colors2024['red-light-1'],
      overflow: 'hidden',
    },
    tipItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors2024['red-light-1'],
      paddingHorizontal: 12,
      paddingVertical: 16,
      borderRadius: 12,
    },
    tipIcon: {
      width: 14,
      justifyContent: 'center',
      height: 20,
    },
    tipText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      flex: 1,
      fontFamily: 'SF Pro Rounded',
      color: colors2024['red-default'],
    },
    loadingRisks: {
      backgroundColor: colors2024['red-light-1'],
      borderRadius: 8,
      flex: 1,
    },
    checkbox: {
      display: 'flex',
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    checkboxText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-foot'],
    },
  };
});
