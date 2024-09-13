import { StyleSheet, View, Text } from 'react-native';
import React, { useEffect, useMemo } from 'react';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { maxBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  ParsedActionData,
  CancelTxRequireData,
} from '@rabby-wallet/rabby-action';
import IconAlert from '@/assets/icons/sign/tx/alert.svg';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors['blue-light-1'],
      borderColor: colors['blue-default'],
      borderWidth: 1,
      borderRadius: 6,
      padding: 12,
      position: 'relative',
      marginBottom: 16,
    },
    internalTransaction: {
      padding: 0,
      position: 'absolute',
      textAlign: 'center',
      zIndex: 1,
      top: -7,
      left: 10,
    },
    internalTransactionText: {
      color: colors['blue-default'], // Assuming a default color if var(--r-blue-default) is not defined
      fontSize: 12,
      lineHeight: 12,
    },
    bg: {
      position: 'absolute',
      bottom: 0,
      left: 0.5,
      width: '100%',
      height: 6,
      backgroundColor: colors['blue-light-1'], // Assuming a default color if var(--r-blue-light-1) is not defined
      zIndex: -1,
    },
    txItem: {
      display: 'flex',
      justifyContent: 'space-between',
      flexDirection: 'row',
    },
    txItemTextFirst: {
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 16,
      color: colors['neutral-title-1'], // Assuming a default color if var(--r-neutral-title-1) is not defined
    },
    txItemTextSecond: {
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 16,
      color: colors['neutral-foot'], // Assuming a default color if var(--r-neutral-foot) is not defined
    },
    gasPriceTip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 24,
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 16,
      color: '#333333',
      marginTop: 15,
    },
    gasPriceTipText: {
      color: '#333333',
      fontSize: 14,
      lineHeight: 16,
    },
  });

const CancelTx = ({
  data,
  requireData,
  raw,
}: {
  data: ParsedActionData['cancelTx'];
  requireData: CancelTxRequireData;
  chain: Chain;
  raw: Record<string, string | number>;
  engineResults: Result[];
  onChange(tx: Record<string, any>): void;
}) => {
  const { t } = useTranslation();
  const { init } = useApprovalSecurityEngine();
  const colors = useThemeColors();
  const styles = getStyle(colors);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingTx = useMemo(() => {
    let tx: { type: string; gasPrice: number } | null = null;
    requireData.pendingTxs.forEach(group => {
      let type = t('page.signTx.unknownAction');
      const target = maxBy(group.txs, item =>
        Number(item.rawTx.gasPrice || item.rawTx.maxFeePerGas || 0),
      );
      if (target) {
        // TODO
        // type = getActionTypeText(target.rawTx.);
        const res = {
          type,
          gasPrice: Number(
            target.rawTx.gasPrice || target.rawTx.maxFeePerGas || 0,
          ),
        };
        if (tx && res.gasPrice > tx.gasPrice) {
          tx = res;
        } else {
          tx = res;
        }
      }
    });
    return tx as { type: string; gasPrice: number } | null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requireData]);

  const canCancel = useMemo(() => {
    if (!pendingTx) return true;
    const currentGasPrice = Number(raw.gasPrice || raw.maxFeePerGas || 0);
    return currentGasPrice > pendingTx.gasPrice;
  }, [raw, pendingTx]);

  return (
    <View>
      {requireData.pendingTxs.length > 0 && (
        <>
          <View style={styles.container}>
            <View style={styles.internalTransaction}>
              <Text style={styles.internalTransactionText}>
                {t('page.signTx.cancelTx.txToBeCanceled')}
              </Text>
              <View style={styles.bg} />
            </View>
            {pendingTx && (
              <View style={styles.txItem}>
                <Text style={styles.txItemTextFirst}>{pendingTx.type}</Text>
                <Text style={styles.txItemTextSecond}>
                  {pendingTx.gasPrice / 1e9} Gwei
                </Text>
              </View>
            )}
          </View>
          {pendingTx && !canCancel && (
            <View style={styles.gasPriceTip}>
              <IconAlert
                style={{
                  marginRight: 10,
                }}
                width={15}
              />
              <Text style={styles.gasPriceTipText}>
                {t('page.signTx.cancelTx.gasPriceAlert', {
                  value: pendingTx.gasPrice / 1e9,
                })}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
};

export default CancelTx;
