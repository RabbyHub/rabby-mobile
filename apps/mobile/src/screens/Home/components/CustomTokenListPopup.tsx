import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { RcIconAddCircle } from '@/assets/icons/address';
import { RcIconEmptyCC } from '@/assets/icons/gnosis';
import { AppBottomSheetModal, Button } from '@/components';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useSheetModals } from '@/hooks/useSheetModal';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Dialog } from '@rneui/themed';
import { useMemoizedFn } from 'ahooks';
import { AbstractPortfolioToken } from '../types';
import { TokenList } from './TokenList';
import { useChainList } from '@/hooks/useChainList';
import { navigateDeprecated } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import AutoLockView from '@/components/AutoLockView';

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
  const [isShowDialog, setIsShowDialog] = React.useState(false);

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
      ? t('page.dashboard.assets.table.testnetTokens', {
          count: count,
        })
      : t('page.dashboard.assets.table.customizeTokens', {
          count: count,
        });
  }, [tokens?.length, t, isTestnet]);

  const { testnetList } = useChainList();

  return (
    <>
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
                {isTestnet ? (
                  <Text style={styles.emptyText}>No custom network tokens</Text>
                ) : (
                  <Text style={styles.emptyText}>
                    Custom token added by you will be shown here
                  </Text>
                )}
              </View>
            }
          />
          <FooterButton
            title={'Add Token'}
            onPress={() => {
              if (isTestnet && !testnetList?.length) {
                setIsShowDialog(true);
                return;
              }
              onAddTokenPress?.();
            }}
            icon={<RcIconAddCircle color={colors['neutral-title-2']} />}
          />
        </AutoLockView>
      </AppBottomSheetModal>
      <Dialog
        overlayStyle={styles.dialog}
        backdropStyle={styles.dialogMask}
        onBackdropPress={() => {
          setIsShowDialog(false);
        }}
        isVisible={isShowDialog}>
        <View style={styles.dialogHeader}>
          <Text style={styles.dialogTitle}>
            Please add custom network first
          </Text>
        </View>
        <View style={styles.dialogBody}>
          <Text style={styles.dialogContent}>
            You need to add the token after adding the custom network
          </Text>
        </View>
        <View style={styles.dialogFooter}>
          <Button
            title="Add Custom Network"
            onPress={() => {
              setIsShowDialog(false);
              onClose?.();
              navigateDeprecated(RootNames.StackSettings, {
                screen: RootNames.CustomTestnet,
              });
            }}
          />
        </View>
      </Dialog>
    </>
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

    dialog: {
      borderRadius: 16,
      padding: 0,
      backgroundColor: colors['neutral-bg-1'],
      width: 353,
      maxWidth: '100%',
    },
    dialogMask: {
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    dialogHeader: {
      paddingHorizontal: 20,
      paddingTop: 20,
      marginBottom: 16,
    },
    dialogTitle: {
      color: colors['neutral-title-1'],
      fontSize: 20,
      fontWeight: '500',
      lineHeight: 24,
      textAlign: 'center',
    },
    dialogBody: {
      paddingHorizontal: 20,
      minHeight: 85,
    },
    dialogContent: {
      color: colors['neutral-body'],
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    dialogFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors['neutral-line'],
      padding: 20,
    },
  });
