import { RcIconCheckedCC } from '@/assets/icons/common';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import OneKeySvg from '@/assets/icons/wallet/onekey.svg';
import { Account } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import { Loading } from '@/screens/Bridge/components/BridgeSwitchBtn';
import { createGetStyles2024 } from '@/utils/styles';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Dots } from '../Popup/Dots';

export type MiniActionStatusTask = {
  status: 'idle' | 'active' | 'paused' | 'completed';
  txStatus?: 'idle' | 'sended' | 'signed' | 'failed';
  total: number;
  currentActiveIndex: number;
};

interface Props {
  account: Account;
  task: MiniActionStatusTask;
}

export const MiniActionStatus: React.FC<Props> = ({ task, account }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { txStatus, total, currentActiveIndex: current } = task;
  const { t } = useTranslation();

  if (task.status === 'idle') {
    return null;
  }

  return (
    <>
      {task.status === 'completed' ? (
        <>
          <View style={[styles.statusContainer, styles.statusContainerSuccess]}>
            <RcIconCheckedCC
              width={16}
              height={16}
              color={colors2024['green-default']}
            />

            <Text style={[styles.statusText, styles.statusTextSuccess]}>
              {t('page.miniSignFooterBar.status.txCreated')}
            </Text>
          </View>
        </>
      ) : current + 1 === total && txStatus === 'signed' ? (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {t('page.miniSignFooterBar.status.txSigned')}
          </Text>
          <Dots />
        </View>
      ) : (
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
      )}
    </>
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
}));
