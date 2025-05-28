import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { RcIconTagYou } from '@/assets/icons/address';
import { RcIconCheckedFilledCC, RcIconUncheckCC } from '@/assets/icons/common';
import { NameAndAddress } from '@/components/NameAndAddress';
import { useAccounts } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { SafeMessage } from '@rabby-wallet/gnosis-sdk';
import { StyleSheet, Text, View } from 'react-native';

interface MessageConfirmationsProps {
  confirmations: SafeMessage['confirmations'];
  threshold: number;
  owners: string[];
}

export const GnosisMessageQueueConfirmations = React.memo(
  ({ confirmations, threshold, owners }: MessageConfirmationsProps) => {
    const { t } = useTranslation();
    const themeColors = useThemeColors();
    const styles = useMemo(() => getStyles(themeColors), [themeColors]);
    const { accounts: visibleAccounts } = useAccounts({
      disableAutoFetch: true,
    });

    return (
      <View style={styles.txConfirm}>
        <View style={styles.txConfirmHead}>
          {confirmations.length >= threshold ? (
            <Text style={styles.txConfirmTitle}>
              {t('Enough signature collected')}
            </Text>
          ) : (
            <Text style={styles.txConfirmTitle}>
              <Text style={styles.number}>
                {threshold - confirmations.length}
              </Text>{' '}
              more confirmation needed
            </Text>
          )}
        </View>
        <View>
          {owners.map(owner => {
            const isChecked = confirmations.find(confirm =>
              isSameAddress(confirm.owner, owner),
            );
            const isTagYou = visibleAccounts.find(account =>
              isSameAddress(account.address, owner),
            );
            return (
              <View style={[styles.listItem]} key={owner}>
                {isChecked ? (
                  <RcIconCheckedFilledCC style={styles.iconCheck} />
                ) : (
                  <RcIconUncheckCC style={styles.iconCheck} />
                )}
                <NameAndAddress
                  address={owner}
                  nameStyle={[styles.nameStyle, styles.selected]}
                  addressStyle={[styles.addressStyle, styles.selected]}
                  style={styles.nameAndAddress}
                  hideCopy
                />
                {isTagYou ? <RcIconTagYou /> : null}
              </View>
            );
          })}
        </View>
      </View>
    );
  },
);

const getStyles = createGetStyles(colors => ({
  txConfirm: {
    backgroundColor: colors['neutral-card-2'],
    borderRadius: 6,
  },
  txConfirmHead: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors['neutral-line'],
  },
  txConfirmTitle: {
    fontSize: 13,
    color: colors['neutral-foot'],
  },
  number: {
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    minWidth: 0,
  },
  iconCheck: {
    width: 16,
    height: 16,
  },
  nameAndAddress: {
    flexShrink: 1,
    minWidth: 0,
  },
  nameStyle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 18,
    color: colors['neutral-foot'],
  },
  addressStyle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 18,
    color: colors['neutral-foot'],
  },
  selected: {
    color: colors['neutral-title-1'],
  },
}));
