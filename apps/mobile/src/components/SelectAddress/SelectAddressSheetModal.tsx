import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BottomSheetBackdrop,
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
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '../GlobalBottomSheetModal';
import FooterComponentForConfirm from '../customized/FooterComponentForConfirm';
import { MODAL_NAMES } from '../GlobalBottomSheetModal/types';
import ModalConfirmDiscard from './components/ModalConfirmDiscard';
import AppBottomSheetBackdrop from '../patches/BottomSheetBackdrop';

export interface SelectAddressProps {
  visible: boolean;
  onConfirm?(account: UIContactBookItem): void;
  onClose?(options: { behavior: 'canceled' | 'confirmed' }): void;
}

export function SelectAddressSheetModal({
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

  const confirmIdRef = useRef<string | null>(null);
  const onPressSaveButton = useCallback(async () => {
    if (isEditing) {
      if (confirmIdRef.current) return;

      const clearConfirm = () => {
        if (confirmIdRef.current) {
          removeGlobalBottomSheetModal(confirmIdRef.current);
          confirmIdRef.current = null;
        }
      };

      confirmIdRef.current = createGlobalBottomSheetModal({
        name: MODAL_NAMES.SIMPLE_CONFIRM,
        title: t('component.Contact.ListModal.authModal.title'),
        bottomSheetModalProps: {
          footerComponent: () => {
            return (
              <FooterComponentForConfirm
                confirmButtonProps={{
                  type: 'primary',
                }}
                onConfirm={async () => {
                  try {
                    await setWhitelist(localWhiteList);
                    setEditing(!isEditing);
                    // onClose?.({ behavior: 'confirmed' });
                  } finally {
                    clearConfirm();
                  }
                }}
                onCancel={() => {
                  clearConfirm();
                }}
              />
            );
          },
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
        snapPoints={['70%']}
        enablePanDownToClose={!isEditing}
        enableDismissOnClose={true}
        backdropComponent={renderBackdrop}
        onDismiss={onModalDismiss}
        footerComponent={() => (
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
        )}
        enableContentPanningGesture={false}>
        <BottomSheetView style={[styles.container]}>
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
                      idx > 0 && { marginTop: 16 },
                      idx === arr.length - 1 && { marginBottom: 16 },
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
        </BottomSheetView>
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
  paddingVertical: 20,
};

const getStyles = createGetStyles(colors => {
  return {
    container: {
      paddingVertical: 20,
      flexDirection: 'column',
      position: 'relative',
      height: '100%',

      paddingBottom:
        FOOTER_SIZES.buttonHeight + FOOTER_SIZES.paddingVertical * 2,
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
      paddingVertical: FOOTER_SIZES.paddingVertical,
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
