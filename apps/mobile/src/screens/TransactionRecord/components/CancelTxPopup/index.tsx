import { RcIconRightCC } from '@/assets/icons/common';
import { AppBottomSheetModal } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { Tip } from '@/components/Tip';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { CANCEL_TX_TYPE } from '@/constant';
import { TransactionHistoryItem } from '@/core/services/transactionHistory';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { CancelTxConfirmPopupContent } from '../CancelTxConfirmPopup';

export const CancelTxPopup = ({
  visible,
  onClose,
  tx,
  onCancelTx,
  step,
}: {
  visible?: boolean;
  onClose?(): void;
  tx: TransactionHistoryItem;
  onCancelTx?: (mode: CANCEL_TX_TYPE) => void;
  step?: 'confirm';
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [isShowRemoveLocalPendingTxTips, setIsShowRemoveLocalPendingTxTips] =
    useState(step === 'confirm');

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
      // {
      //   title: t(
      //     'page.activities.signedTx.CancelTxPopup.options.removeLocalPendingTx.title',
      //   ),
      //   desc: t(
      //     'page.activities.signedTx.CancelTxPopup.options.removeLocalPendingTx.desc',
      //   ),
      //   value: CANCEL_TX_TYPE.REMOVE_LOCAL_PENDING_TX,
      // },
    ],
    [t, tx?.hash, tx?.pushType],
  );

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
      setIsShowRemoveLocalPendingTxTips(false);
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  return (
    <AppBottomSheetModal
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'bg1',
        colors: colors2024,
      })}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView style={styles.popup}>
        {isShowRemoveLocalPendingTxTips ? (
          <CancelTxConfirmPopupContent
            onClose={onClose}
            onConfirm={() => {
              onCancelTx?.(CANCEL_TX_TYPE.REMOVE_LOCAL_PENDING_TX);
            }}
          />
        ) : (
          <AutoLockView>
            <View style={styles.header}>
              <Text style={styles.title}>
                {t('page.activities.signedTx.CancelTxPopup.title')}
              </Text>
            </View>
            <View style={styles.list}>
              {options.map(item => {
                const content = (
                  <View
                    style={[
                      styles.item,
                      item.disabled ? styles.itemDisabled : null,
                    ]}>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemDesc}>{item.desc}</Text>
                    </View>
                    <RcIconRightCC color={colors2024['neutral-foot']} />
                  </View>
                );
                return (
                  <TouchableOpacity
                    key={item.value}
                    disabled={!!item.disabled}
                    onPress={() => {
                      if (
                        item.value === CANCEL_TX_TYPE.REMOVE_LOCAL_PENDING_TX
                      ) {
                        setIsShowRemoveLocalPendingTxTips(true);
                        return;
                      }
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
        )}
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  popup: {
    margin: 0,
    height: '100%',
    minHeight: 364,
    // backgroundColor: colors2024['neutral-bg-1'],
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    paddingBottom: 0,
  },
  list: {
    paddingHorizontal: 20,
    flexDirection: 'column',
    gap: 12,
    paddingBottom: 56,
  },
  item: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 24,

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
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 2,
  },
  itemDesc: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
}));
