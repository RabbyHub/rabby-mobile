import React, { useMemo } from 'react';
import { RcIconRightCC } from '@/assets/icons/common';
import { CANCEL_TX_TYPE } from '@/constant';
import { AppColorsVariants } from '@/constant/theme';
import { TransactionHistoryItem } from '@/core/services/transactionHistory';
import { useThemeColors } from '@/hooks/theme';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Tip } from '../Tip';
import AutoLockView from '../AutoLockView';
/**
 * @deprecated
 */
export const CancelTxPopup = ({
  tx,
  onCancelTx,
}: {
  tx: TransactionHistoryItem;
  onCancelTx?: (mode: CANCEL_TX_TYPE) => void;
}) => {
  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const options = useMemo(
    () => [
      {
        title: t(
          'page.activities.signedTx.CancelTxPopup.options.quickCancel.title',
        ),
        desc: t(
          'page.activities.signedTx.CancelTxPopup.options.quickCancel.desc',
        ),
        value: CANCEL_TX_TYPE.QUICK_CANCEL,
        tips: t(
          'page.activities.signedTx.CancelTxPopup.options.quickCancel.tips',
        ),
        disabled: tx?.pushType !== 'low_gas' || tx?.hash,
      },
      {
        title: t(
          'page.activities.signedTx.CancelTxPopup.options.onChainCancel.title',
        ),
        desc: t(
          'page.activities.signedTx.CancelTxPopup.options.onChainCancel.desc',
        ),
        value: CANCEL_TX_TYPE.ON_CHAIN_CANCEL,
      },
    ],
    [t, tx?.hash, tx?.pushType],
  );

  return (
    <AutoLockView as="BottomSheetView">
      <Text style={styles.title}>
        {t('page.activities.signedTx.CancelTxPopup.title')}
      </Text>
      <View style={styles.list}>
        {options.map(item => {
          const content = (
            <View
              style={[styles.item, item.disabled ? styles.itemDisabled : null]}>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDesc}>{item.desc}</Text>
              </View>
              <RcIconRightCC color={colors['neutral-foot']} />
            </View>
          );
          return (
            <TouchableOpacity
              key={item.value}
              disabled={!!item.disabled}
              onPress={() => {
                onCancelTx?.(item.value);
              }}>
              {item.disabled ? (
                <Tip content={item.tips}>{content}</Tip>
              ) : (
                content
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </AutoLockView>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    title: {
      color: colors['neutral-title1'],
      fontSize: 24,
      lineHeight: 29,
      fontWeight: '500',
      textAlign: 'center',
      marginBottom: 16,
      marginTop: 10,
    },
    list: {
      paddingHorizontal: 20,
      flexDirection: 'column',
      gap: 12,
    },
    item: {
      backgroundColor: colors['neutral-card2'],
      borderRadius: 6,
      paddingVertical: 13,
      paddingHorizontal: 16,

      flexDirection: 'row',
      alignItems: 'center',
    },
    itemDisabled: {
      opacity: 0.5,
    },
    itemContent: {
      marginRight: 'auto',
    },
    itemTitle: {
      color: colors['neutral-title1'],
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      marginBottom: 4,
    },
    itemDesc: {
      color: colors['neutral-body'],
      fontSize: 13,
      lineHeight: 16,
    },
  });
