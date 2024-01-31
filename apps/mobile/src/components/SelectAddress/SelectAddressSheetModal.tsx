import { useRef, useEffect, useMemo, useState } from 'react';
import { Dimensions, View, Text } from 'react-native';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';

import { AppBottomSheetModal } from '../customized/BottomSheet';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { Button } from '../Button';
import { BottomSheetHandlableView } from '../customized/BottomSheetHandle';
import { UIContactBookItem } from '@/core/apis/contact';
import { useAccountsToDisplay } from '@/hooks/accountToDisplay';
import { useWhitelist } from '@/hooks/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import AccountCard from './components/AccountCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSwitch } from '@/hooks/useSwitch';

export interface SelectAddressProps {
  visible: boolean;
  address?: string;
  onConfirm?(account: UIContactBookItem): void;
  onCancel?(): void;
}

export function SelectAddressSheetModal({
  visible,
  address,
  onConfirm,
  onCancel,
}: React.PropsWithoutRef<RNViewProps & SelectAddressProps>) {
  const insets = useSafeAreaInsets();
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    selectAddress: modalRef,
  });

  useEffect(() => {
    toggleShowSheetModal('selectAddress', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { accountsList, fetchAllAccountsToDisplay } = useAccountsToDisplay();

  const { on: isEditing, turn: toggleEditing } = useSwitch();
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

  return (
    <AppBottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={['70%']}
      onDismiss={onCancel}
      enableContentPanningGesture={false}
      footerComponent={() => (
        <View style={[styles.footerContainer, styles.innerBlock]}>
          <Button
            containerStyle={styles.footerButtonContainer}
            title={
              isEditing
                ? `Save to Whitelist (${localWhiteList.length})`
                : 'Edit Whitelist'
            }
            onPress={async () => {
              if (isEditing) {
                try {
                  await setWhitelist(localWhiteList);
                } finally {
                }
              }
              toggleEditing(!isEditing);
            }}
          />
        </View>
      )}>
      <BottomSheetView style={[styles.container]}>
        <View style={[styles.titleArea, styles.innerBlock]}>
          <Text style={[styles.modalTitle, styles.modalMainTitle]}>
            Select Address
          </Text>
          <BottomSheetHandlableView>
            <Text style={[styles.modalTitle, styles.modalSubTitle]}>
              You can only send to the addresses in the whitelist within Rabby
              once enabled. You can disable it in "Settings".
            </Text>
          </BottomSheetHandlableView>
        </View>

        <BottomSheetScrollView style={[styles.scrollableBlock]}>
          <View style={[styles.accountList, styles.innerBlock]}>
            {sortedAccountsList.map((account, idx) => {
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
                  style={idx > 0 && { marginTop: 16 }}
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
    },
    accountList: {
      marginTop: 16,
      height: '100%',
      maxHeight: 300,
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
