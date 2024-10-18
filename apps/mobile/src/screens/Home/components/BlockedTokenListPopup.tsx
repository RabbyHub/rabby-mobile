import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { RcIconEmptyCC } from '@/assets/icons/gnosis';
import { AppBottomSheetModal } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useSheetModals } from '@/hooks/useSheetModal';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import { AbstractPortfolioToken } from '../types';
import { TokenList } from './TokenList';
import AutoLockView from '@/components/AutoLockView';

type Props = {
  tokens?: AbstractPortfolioToken[];
  visible?: boolean;
  onClose?: () => void;
  onTokenPress?: (token: AbstractPortfolioToken) => void;
};
export const BlockedTokenListPopup = ({
  tokens,
  visible,
  onClose,
  onTokenPress,
}: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  const { t } = useTranslation();

  const {
    sheetModalRefs: { modalRef },
    toggleShowSheetModal: _toggleShowSheetModal,
  } = useSheetModals({
    modalRef: useRef<BottomSheetModal>(null),
  });

  const toggleShowSheetModal = useMemoizedFn(_toggleShowSheetModal);

  useEffect(() => {
    toggleShowSheetModal('modalRef', !!visible);
  }, [toggleShowSheetModal, visible]);

  const title = useMemo(() => {
    const count = tokens?.length || 0;
    return t('page.dashboard.assets.table.blockedTokens', {
      count: count,
    });
  }, [t, tokens?.length]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      snapPoints={['80%']}
      onDismiss={onClose}>
      <AutoLockView style={{ height: '100%' }}>
        <TokenList
          isTestnet={true}
          onTokenPress={onTokenPress}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.desc}>
                Tokens on this list will not be added to the total balance.
              </Text>
            </View>
          }
          data={tokens || []}
          ListEmptyComponent={
            <View style={styles.empty}>
              <RcIconEmptyCC
                color={colors['neutral-body']}
                style={styles.emptyImage}
              />
              <Text style={styles.emptyText}>
                Token blocked by you will be shown here
              </Text>
            </View>
          }
        />
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    header: {
      marginTop: 14,
      marginBottom: 19,
    },
    title: {
      textAlign: 'center',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      marginBottom: 8,
    },
    desc: {
      textAlign: 'center',
      fontSize: 13,
      lineHeight: 16,
      color: colors['neutral-foot'],
    },

    empty: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 160,
    },
    emptyImage: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['neutral-body'],
    },
  });
