import { Account } from '@/core/services/preference';
import AuthButton, { IAuthButtonProps } from '../AuthButton';
import { useGetMiniSignInfo } from '@/hooks/useMiniApprovalTask';
import { isHardWareAccountAccountSupportMiniApproval } from '@/utils/account';
import { Pressable, Text, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { Loading } from '@/screens/Bridge/components/BridgeSwitchBtn';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import OneKeySvg from '@/assets/icons/wallet/onekey.svg';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../Button';
import { CheckBoxRect } from '../CheckBox';
import { useMiniDirectSignGasFeeDisableProcess } from '@/hooks/useMiniApprovalDirectSign';

export const DirectSignBtn = ({
  account,
  showHardWalletProcess,
  riskReset,
  riskLabel,
  showRiskTips,
  // isProcess,
  ...props
}: IAuthButtonProps & {
  account?: Account | null;
  showHardWalletProcess?: boolean;
  riskReset?: boolean;
  riskLabel?: React.ReactNode;
  showRiskTips?: boolean;

  // isProcess?: boolean;
}) => {
  const {
    onFinished,
    onCancel: _onCancel,
    onBeforeAuth,
    authTitle,
    syncUnlockTime,
    ...btnProps
  } = props;
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle });

  const isHardwareWallet = useMemo(
    () => isHardWareAccountAccountSupportMiniApproval(account?.type),
    [account?.type],
  );

  const {
    setCheckGasFee,
    checkGasFee: checkGasFee,
    gasFeeDisableProcess,
  } = useMiniDirectSignGasFeeDisableProcess();

  const {
    status,
    totalTxLength: total,
    currentActiveIndex: current,
  } = useGetMiniSignInfo();

  const showProcess =
    // !!isProcess &&
    !!showHardWalletProcess &&
    !!account &&
    isHardwareWallet &&
    status === 'active';

  const hardwareWalletOnPress = useCallback(() => {
    onBeforeAuth?.();
    onFinished?.();
  }, [onBeforeAuth, onFinished]);

  const [riskChecked, setRiskChecked] = useState(false);
  useEffect(() => {
    if (riskReset) {
      setRiskChecked(false);
    }
  }, [riskReset]);

  const onCancel = useCallback(() => {
    setRiskChecked(false);
    if (_onCancel) {
      _onCancel();
    }
  }, [_onCancel]);

  const disabled = showRiskTips
    ? !riskChecked || props.disabled
    : props.disabled;
  return (
    <View>
      {showRiskTips ? (
        <Pressable
          style={styles.riskContainer}
          onPress={() => {
            setRiskChecked(!riskChecked);
            if (checkGasFee && !riskChecked) {
              setCheckGasFee(false);
            }
          }}>
          <CheckBoxRect checked={riskChecked} />
          <Text style={styles.warningText}>
            {t('page.bridge.showMore.signWarning')}
          </Text>
        </Pressable>
      ) : null}
      {showProcess ? (
        <View style={styles.statusContainer}>
          {account.type === KEYRING_CLASS.HARDWARE.LEDGER ? (
            <View style={styles.loadingContainer}>
              <Loading />
              <LedgerSVG width={22} height={22} />
            </View>
          ) : account.type === KEYRING_CLASS.HARDWARE.ONEKEY ? (
            <View style={styles.loadingContainer}>
              <Loading />
              <OneKeySvg width={22} height={22} />
            </View>
          ) : null}
          {total > 1 ? (
            <>
              <Text style={styles.statusText}>
                {t('page.miniSignFooterBar.status.txSendings', {
                  current: current + 1,
                  total: total,
                })}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.statusText}>
                {t('page.miniSignFooterBar.status.txSending')}
              </Text>
            </>
          )}
        </View>
      ) : isHardwareWallet ? (
        <Button
          {...btnProps}
          disabled={disabled}
          icon={
            account?.type === KEYRING_CLASS.HARDWARE.LEDGER ? (
              <LedgerSVG width={22} height={22} />
            ) : (
              <OneKeySvg width={22} height={22} />
            )
          }
          onPress={hardwareWalletOnPress}
        />
      ) : (
        <AuthButton {...props} onCancel={onCancel} disabled={disabled} />
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // padding: 16,
    gap: 8,
    backgroundColor: colors2024['neutral-bg-4'],
    borderRadius: 16,
    height: 56,
    marginTop: 12,
  },
  statusContainerSuccess: {
    backgroundColor: colors2024['green-light'],
  },
  statusText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  statusTextSuccess: {
    color: colors2024['green-default'],
  },
  loadingContainer: {
    position: 'relative',
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  riskContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  warningText: {
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
