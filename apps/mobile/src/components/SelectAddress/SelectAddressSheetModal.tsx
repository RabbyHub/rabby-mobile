import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BottomSheetBackdropProps,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import { AppBottomSheetModal } from '../customized/BottomSheet';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { Button } from '../Button';
import { BottomSheetHandlableView } from '../customized/BottomSheetHandle';
import { UIContactBookItem } from '@/core/apis/contact';
import { useAccountsToDisplay } from '@/hooks/accountToDisplay';
import { useWhitelist } from '@/hooks/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import AccountCard from './components/AccountCard';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { useFocusEffect } from '@react-navigation/native';
import ModalConfirmDiscard from './components/ModalConfirmDiscard';
import AppBottomSheetBackdrop from '../patches/BottomSheetBackdrop';
import { ModalLayouts } from '@/constant/layout';
import { AuthenticationModal } from '../AuthenticationModal/AuthenticationModal';
import { apisLock } from '@/core/apis';
import { useLoadLockInfo } from '@/hooks/useLock';
import AutoLockView from '../AutoLockView';

export interface SelectAddressProps {
  heightPercent?: `${number}%`;
  visible: boolean;
  onConfirm?(account: UIContactBookItem): void;
  onClose?(options: { behavior: 'canceled' | 'confirmed' }): void;
}

export function SelectAddressSheetModal({
  heightPercent = ModalLayouts.defaultHeightPercentText,
  visible,
  onConfirm,
  onClose,
}: React.PropsWithoutRef<RNViewProps & SelectAddressProps>) {
  const { t } = useTranslation();
  const { sheetModalRef, toggleShowSheetModal } = useSheetModal();

  useEffect(() => {
    toggleShowSheetModal(visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { accountsList, fetchAllAccountsToDisplay } = useAccountsToDisplay();

  const [isEditing, setEditing] = useState(false);
  const [isConfirmingDiscard, setIsConfirmDiscard] = useState(false);
  const { whitelist, whitelistEnabled, setWhitelist } = useWhitelist();
  const [localWhiteList, setLocalWhiteList] = useState<string[]>([]);
  useEffect(() => {
    if (isEditing) {
      setLocalWhiteList(whitelist);
    }
  }, [isEditing, whitelist]);

  useEffect(() => {
    if (visible) {
      fetchAllAccountsToDisplay();
    }
  }, [visible, fetchAllAccountsToDisplay]);

  const sortedAccountsList = useMemo(() => {
    if (!whitelistEnabled) {
      return accountsList;
    }
    return [...accountsList].sort((a, b) => {
      let an = 0,
        bn = 0;
      if (whitelist?.some(w => addressUtils.isSameAddress(w, a.address))) {
        an = 1;
      }
      if (whitelist?.some(w => addressUtils.isSameAddress(w, b.address))) {
        bn = 1;
      }
      return bn - an;
    });
  }, [whitelistEnabled, accountsList, whitelist]);

  const onPressSaveButton = useCallback(async () => {
    if (isEditing) {
      AuthenticationModal.show({
        confirmText: t('global.Confirm'),
        cancelText: t('global.Cancel'),
        title: t('component.Contact.ListModal.authModal.title'),
        validationHandler: async (password: string) =>
          apisLock.throwErrorIfInvalidPwd(password),
        onFinished() {
          setWhitelist(localWhiteList);
          setEditing(!isEditing);
        },
      });
    } else {
      setEditing(!isEditing);
    }
  }, [t, isEditing, setEditing, setWhitelist, localWhiteList]);

  const onModalDismiss = useCallback(() => {
    if (isEditing) {
      setIsConfirmDiscard(true);
    } else {
      onClose?.({ behavior: 'canceled' });
    }
  }, [isEditing, onClose]);
  const onCancelDiscard = useCallback(() => {
    setIsConfirmDiscard(false);
  }, []);
  const onConfirmedDiscard = useCallback(() => {
    setIsConfirmDiscard(false);
    setEditing(false);

    onClose?.({ behavior: 'canceled' });
  }, [setEditing, onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => {
      return (
        <AppBottomSheetBackdrop
          {...props}
          pressBehavior="none"
          onPress={onModalDismiss}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      );
    },
    [onModalDismiss],
  );

  const { onHardwareBackHandler } = useHandleBackPressClosable(
    useCallback(() => {
      return !visible;
    }, [visible]),
  );

  useFocusEffect(onHardwareBackHandler);

  return (
    <>
      <AppBottomSheetModal
        ref={sheetModalRef}
        index={0}
        snapPoints={[heightPercent]}
        backgroundStyle={styles.sheet}
        enablePanDownToClose={!isEditing}
        enableDismissOnClose={true}
        backdropComponent={renderBackdrop}
        onDismiss={onModalDismiss}
        footerComponent={() =>
          !whitelistEnabled ? null : (
            <View style={[styles.footerContainer, styles.innerBlock]}>
              <Button
                containerStyle={styles.footerButtonContainer}
                title={
                  isEditing
                    ? `Save to Whitelist (${localWhiteList.length})`
                    : 'Edit Whitelist'
                }
                onPress={onPressSaveButton}
              />
            </View>
          )
        }
        enableContentPanningGesture={false}>
        <AutoLockView as="BottomSheetView" style={[styles.container]}>
          <BottomSheetHandlableView
            style={[styles.titleArea, styles.innerBlock]}>
            <Text style={[styles.modalTitle, styles.modalMainTitle]}>
              {t('component.Contact.ListModal.title')}
            </Text>
            <View>
              <Text style={[styles.modalTitle, styles.modalSubTitle]}>
                {whitelistEnabled
                  ? t('component.Contact.ListModal.whitelistEnabled')
                  : t('component.Contact.ListModal.whitelistDisabled')}
              </Text>
            </View>
          </BottomSheetHandlableView>

          <BottomSheetScrollView style={[styles.scrollableBlock]}>
            <View style={[styles.accountList, styles.innerBlock]}>
              {sortedAccountsList.map((account, idx, arr) => {
                const key = `${account.address}-${account.brandName}-${account.aliasName}`;
                const inWhitelistPersisted = !!whitelist.find(wa =>
                  addressUtils.isSameAddress(wa, account.address),
                );
                const inWhitelistLocal = !isEditing
                  ? inWhitelistPersisted
                  : !!localWhiteList.find(wa =>
                      addressUtils.isSameAddress(wa, account.address),
                    );

                return (
                  <AccountCard
                    key={key}
                    account={account}
                    inWhitelist={inWhitelistLocal || !whitelistEnabled}
                    isEditing={isEditing}
                    style={[
                      idx > 0 && { marginTop: 8 },
                      idx === arr.length - 1 && { marginBottom: 8 },
                    ]}
                    onPress={() => {
                      if (isEditing) {
                        setLocalWhiteList(wl => {
                          if (inWhitelistLocal) {
                            return wl.filter(
                              w =>
                                !addressUtils.isSameAddress(w, account.address),
                            );
                          } else {
                            return [...wl, account.address];
                          }
                        });
                      } else {
                        onConfirm?.({
                          name: account.aliasName,
                          address: account.address,
                        });
                      }
                    }}
                  />
                );
              })}
            </View>
          </BottomSheetScrollView>
        </AutoLockView>
      </AppBottomSheetModal>
      <ModalConfirmDiscard
        visible={isConfirmingDiscard}
        onCancel={onCancelDiscard}
        onConfirm={onConfirmedDiscard}
      />
    </>
  );
}

const FOOTER_SIZES = {
  buttonHeight: 52,
  ...Platform.select({
    ios: {
      paddingTop: 16,
      paddingBottom: 24,
    },
    android: {
      paddingTop: 16,
      paddingBottom: 24,
    },
  })!,
};

const getStyles = createGetStyles(colors => {
  return {
    sheet: {
      backgroundColor: colors['neutral-bg-1'],
    },
    container: {
      paddingTop: ModalLayouts.titleTopOffset,
      flexDirection: 'column',
      position: 'relative',
      height: '100%',

      paddingBottom:
        FOOTER_SIZES.buttonHeight +
        FOOTER_SIZES.paddingTop +
        FOOTER_SIZES.paddingBottom,
    },
    innerBlock: {
      paddingHorizontal: 20,
    },
    titleArea: {
      justifyContent: 'center',
      flexShrink: 0,
    },
    modalTitle: {
      color: colors['neutral-title1'],
    },
    modalMainTitle: {
      fontSize: 20,
      fontWeight: '500',
      textAlign: 'center',
    },
    modalSubTitle: {
      fontSize: 13,
      fontWeight: '400',
      marginTop: 8,
      textAlign: 'left',
      lineHeight: 18,
    },

    scrollableBlock: {
      flexShrink: 1,
      height: '100%',
    },
    accountList: {
      marginTop: 16,
      height: '100%',
      // maxHeight: 300,
    },

    footerContainer: {
      borderTopWidth: 0.5,
      borderTopStyle: 'solid',
      borderTopColor: colors['neutral-line'],
      backgroundColor: colors['neutral-bg-1'],
      paddingTop: FOOTER_SIZES.paddingTop,
      paddingBottom: FOOTER_SIZES.paddingBottom,
      flexShrink: 0,

      position: 'absolute',
      bottom: 0,
      left: 0,
      width: '100%',
      alignItems: 'center',
    },
    footerButtonContainer: {
      width: 248,
      height: FOOTER_SIZES.buttonHeight,
    },
    footerText: {},
  };
});
