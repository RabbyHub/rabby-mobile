import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { RcIconAddCircle } from '@/assets/icons/address';
import { RcIconEmptyCC } from '@/assets/icons/gnosis';
import { AppBottomSheetModal } from '@/components';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { AppColorsVariants } from '@/constant/theme';
import { apiCustomTestnet } from '@/core/apis';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { useSheetModals } from '@/hooks/useSheetModal';
import { customTestnetTokenToTokenItem } from '@/utils/token';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useMemoizedFn, useRequest } from 'ahooks';
import { AbstractPortfolioToken } from '../types';
import { DisplayedToken } from '../utils/project';
import { TokenList } from './TokenList';

type Props = {
  tokens?: AbstractPortfolioToken[];
  isTestnet?: boolean;
  visible?: boolean;
  onClose?: () => void;
  onTokenPress?: (token: AbstractPortfolioToken) => void;
  onAddTokenPress?: () => void;
};
export const CustomTokenListPopup = ({
  tokens,
  isTestnet,
  visible,
  onClose,
  onTokenPress,
  onAddTokenPress,
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
    return isTestnet
      ? `${count}  custom network tokens`
      : `${count} custom tokens`;
  }, [tokens?.length, isTestnet]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      snapPoints={['70%']}
      onDismiss={onClose}>
      <TokenList
        isTestnet={true}
        onTokenPress={onTokenPress}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.desc}>
              The token in this list will not be added to total balance
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
            <Text style={styles.emptyText}>No custom network tokens</Text>
          </View>
        }
      />
      <FooterButton
        title={'Add Token'}
        onPress={onAddTokenPress}
        icon={<RcIconAddCircle color={colors['neutral-title-2']} />}
      />
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
    footer: {
      paddingBottom: 48,
      paddingHorizontal: 20,
      paddingTop: 16,
      position: 'relative',
    },
    divider: {
      position: 'absolute',
      top: 0,
      right: 20,
      left: 20,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors['neutral-line'],
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
