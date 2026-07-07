import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Alert } from 'react-native';
import { RcArrowRightCC, RcIconCheckmarkCC } from '@/assets/icons/common';

import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { atom, useAtom } from 'jotai';
import AutoLockView from '@/components/AutoLockView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import {
  RcCode,
  RcCountdown,
  RcLockWallet,
  RcManagePassword,
} from '@/assets/icons/settings';
import { DevTestItem, makeNoop, GeneralTestItem } from './testDevUtils';
import { useManagePasswordOnSettings } from '@/screens/ManagePassword/hooks';
import { requestLockWalletAndBackToUnlockScreen } from '@/hooks/navigation';
import { LastUnlockTimeLabel } from '../components/LockAbout';
import {
  APP_FEATURE_SWITCH,
  APP_TEST_PWD,
  NEED_DEVSETTINGBLOCKS,
} from '@/constant';
import { keyringService } from '@/core/services/shared';
import {
  setGenericPassword,
  resetGenericPassword,
  requestGenericPassword,
  RequestGenericPurpose,
  KEYCHAIN_AUTH_TYPES,
  getAuthenticationType,
  getAuthenticationTypeLabel,
} from '@/core/apis/keychain';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { Text } from '@/components/Typography';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { apisKeychain, apisLock } from '@/core/apis';
import { toast } from '@/components2024/Toast';

const walletLockTestItemModalVisibleAtom = atom(false);
export function useWalletLockTestItemModalVisible() {
  const [walletLockTestItemModalVisible, setWalletTestItemModalVisible] =
    useAtom(walletLockTestItemModalVisibleAtom);

  return {
    walletLockTestItemModalVisible,
    setWalletTestItemModalVisible,
  };
}

const RcIconCheckmark = makeThemeIconFromCC(RcIconCheckmarkCC, 'neutral-body');

// Start with a resolved promise
let alertChain = Promise.resolve();

export const alertQueue = (title, message) => {
  // Attach the next alert to the chain
  alertChain = alertChain.then(() => {
    return new Promise(resolve => {
      Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }], {
        cancelable: false,
      });
    });
  });
};

export default function WalletLockTestItemModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    cloudDriveTest: modalRef,
  });

  const {
    walletLockTestItemModalVisible: visible,
    setWalletTestItemModalVisible,
  } = useWalletLockTestItemModalVisible();

  useEffect(() => {
    toggleShowSheetModal('cloudDriveTest', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);
  const navigation = useRabbyAppNavigation();

  const handleCancel = useCallback(() => {
    setWalletTestItemModalVisible(false);
    onCancel?.();
  }, [setWalletTestItemModalVisible, onCancel]);

  const {
    hasSetupCustomPassword,
    openManagePasswordSheetModal,
    openResetPasswordAndKeyringSheetModal,
  } = useManagePasswordOnSettings();

  const handleSetTestPassword = useCallback(async () => {
    const result =
      await apisLock.debugSetUnlockedWalletPasswordToTestPassword();
    if (result.error) {
      toast.show(result.error);
      return { keepModalVisible: true };
    }

    try {
      const authType = apisKeychain.getAuthenticationType();
      if (authType === apisKeychain.KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD) {
        await apisKeychain.resetGenericPassword();
      } else {
        await apisKeychain.setGenericPassword(APP_TEST_PWD, authType);
      }

      toast.success(`Password set to ${APP_TEST_PWD}`);
    } catch (error) {
      console.error(error);
      toast.show('Password changed, but biometric password sync failed');
    }

    return { keepModalVisible: true };
  }, []);

  const Items = (() => {
    const list: DevTestItem[] = [
      {
        label: 'Lock Wallet',
        icon: <RcLockWallet style={styles.labelIcon} />,
        disabled: !hasSetupCustomPassword,
        onPress: () => {
          requestLockWalletAndBackToUnlockScreen();
        },
      },
      {
        label: hasSetupCustomPassword ? 'Clear Password' : 'Set Up Password',
        icon: <RcManagePassword style={styles.labelIcon} />,
        onPress: () => {
          openManagePasswordSheetModal();
        },
        visible: APP_FEATURE_SWITCH.customizePassword || hasSetupCustomPassword,
      },
      {
        label: 'Set Test Password',
        icon: <RcManagePassword style={styles.labelIcon} />,
        disabled: !hasSetupCustomPassword || !APP_TEST_PWD,
        visible: NEED_DEVSETTINGBLOCKS,
        onPress: handleSetTestPassword,
        onDisabledPress: () => {
          toast.show('Unlock and set up a wallet password first');
          return { keepModalVisible: true };
        },
      },
      {
        label: 'Clear Password and Keyrings',
        icon: <RcManagePassword style={styles.labelIcon} />,
        disabled: !hasSetupCustomPassword,
        onPress: () => {
          openResetPasswordAndKeyringSheetModal();
        },
      },
      {
        label: 'Keychain Data',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackTestkits, {
              screen: RootNames.DevDataKeychain,
            }),
          );
        },
      },
      {
        label: 'Time Since Last Unlock',
        icon: <RcCountdown style={styles.labelIcon} />,
        // onPress: () => {},
        rightNode: (
          <Text>
            <LastUnlockTimeLabel />
          </Text>
        ),
      },
      {
        label: 'Check unencryptedKeyringData',
        icon: <RcIconCheckmark style={styles.labelIcon} />,
        onPress: async () => {
          const keyringData =
            await keyringService.DEV_GET_UNENCRYPTED_KEYRING_DATA();
          Alert.alert('Unencrypted Keyring Data', JSON.stringify(keyringData));
        },
      },
      {
        label: 'Keychain Auth Playground',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: () => {
          const currentType = getAuthenticationType();
          const currentLabel = getAuthenticationTypeLabel();
          const options: Array<{
            label: string;
            type: KEYCHAIN_AUTH_TYPES;
            requiresPassword?: boolean;
          }> = [
            {
              label: 'Biometrics (BIOMETRY_CURRENT_SET)',
              type: KEYCHAIN_AUTH_TYPES.BIOMETRICS,
              requiresPassword: true,
            },
            {
              label: 'Biometrics+Passcode (BIOMETRY_ANY_OR_DEVICE_PASSCODE)',
              type: KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE,
              requiresPassword: true,
            },
            {
              label: 'Passcode only (DEVICE_PASSCODE)',
              type: KEYCHAIN_AUTH_TYPES.PASSCODE,
              requiresPassword: true,
            },
            {
              label: 'Remember Me (no access control)',
              type: KEYCHAIN_AUTH_TYPES.REMEMBER_ME,
              requiresPassword: true,
            },
            {
              label: 'Reset keychain entry',
              type: KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD,
            },
          ];

          Alert.alert(
            'Keychain Auth Playground',
            `Current: ${currentLabel} (${currentType})\n\nSelect an auth type to test:`,
            [
              ...options.map(opt => ({
                text: opt.label,
                onPress: async () => {
                  if (!opt.requiresPassword) {
                    await resetGenericPassword();
                    Alert.alert('Reset', 'Keychain entry cleared');
                    return;
                  }
                  AuthenticationModal.show({
                    confirmText: 'Store',
                    title: `Store password as ${opt.label}`,
                    authType: ['password'],
                    async onFinished({ getValidatedPassword }) {
                      const password = getValidatedPassword();
                      try {
                        await setGenericPassword(password, opt.type);
                        Alert.alert(
                          'Success',
                          `${opt.label} — stored successfully`,
                        );
                      } catch (e: any) {
                        Alert.alert('Error', e?.message || String(e));
                      }
                    },
                  });
                },
              })),
              { text: 'Cancel', style: 'cancel' },
            ],
          );
        },
      },
      {
        label: 'Verify Stored Password',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: async () => {
          try {
            const result = await requestGenericPassword({
              purpose: RequestGenericPurpose.VERIFY,
              onPlainPassword: (password: string) => {
                alertQueue('Retrieved Password', password);
              },
            });
            if (!result || !result.actionSuccess) {
              alertQueue('Error', 'Failed to retrieve password from keychain');
            } else {
              alertQueue('Result', JSON.stringify(result));
            }
          } catch (e: any) {
            alertQueue('Error', e?.message || String(e));
          }
        },
      },
      {
        label: 'Get Stored Password',
        icon: <RcCode style={styles.labelIcon} />,
        onPress: async () => {
          try {
            const result = await requestGenericPassword({
              purpose: RequestGenericPurpose.DECRYPT_PWD,
              onPlainPassword: (password: string) => {
                alertQueue('Retrieved Password', password);
              },
            });
            if (!result || !result.actionSuccess) {
              alertQueue('Error', 'Failed to retrieve password from keychain');
            } else {
              alertQueue('Result', JSON.stringify(result));
            }
          } catch (e: any) {
            alertQueue('Error', e?.message || String(e));
          }
        },
      },
    ];

    return list.filter(item => item.visible !== false);
  })();

  const { safeSizes } = useSafeAndroidBottomSizes({
    sheetHeight: getFullHeight(Items.length),
    containerPaddingBottom: SIZES.containerPb,
  });

  return (
    <AppBottomSheetModal
      backgroundStyle={styles.sheet}
      ref={modalRef}
      index={0}
      snapPoints={[safeSizes.sheetHeight]}
      handleStyle={styles.handleStyle}
      onDismiss={handleCancel}
      enableContentPanningGesture={false}>
      <AutoLockView
        as="BottomSheetView"
        style={[
          styles.container,
          {
            paddingBottom: safeSizes.containerPaddingBottom,
          },
        ]}>
        <Text style={styles.title}>Test Wallet Lock</Text>
        <View style={styles.mainContainer}>
          {Items.map((item, idx) => {
            const itemKey = `testitem-${item.label}`;
            const rightNode =
              typeof item.rightNode === 'function'
                ? item.rightNode()
                : item.rightNode;

            return (
              <GeneralTestItem
                {...item}
                key={itemKey}
                itemIndex={idx}
                afterPress={async result => {
                  if (!result?.keepModalVisible)
                    setWalletTestItemModalVisible(false);
                }}>
                <View style={styles.leftCol}>
                  <View style={styles.iconWrapper}>{item.icon}</View>
                  <Text style={styles.settingItemLabel}>{item.label}</Text>
                </View>
                {rightNode || <RcArrowRightCC color={colors['neutral-foot']} />}
              </GeneralTestItem>
            );
          })}
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}

const SIZES = {
  ITEM_HEIGHT: 60,
  ITEM_GAP: 12,
  titleMt: 6,
  titleHeight: 24,
  titleMb: 16,
  HANDLE_HEIGHT: 8,
  containerPb: 42,
};

function getFullHeight(itemsLen: number) {
  return (
    SIZES.HANDLE_HEIGHT +
    (SIZES.titleMt + SIZES.titleHeight + SIZES.titleMb) +
    (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (itemsLen - 1) +
    SIZES.ITEM_HEIGHT +
    SIZES.containerPb
  );
}
const getStyles = createGetStyles((colors, ctx) => {
  return {
    sheet: {
      backgroundColor: colors['neutral-bg-2'],
    },
    handleStyle: {
      height: 8,
      backgroundColor: colors['neutral-bg-2'],
    },
    container: {
      flex: 1,
      paddingVertical: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: '100%',
      paddingBottom: SIZES.containerPb,
      // ...makeDebugBorder('blue')
    },
    title: {
      fontSize: 20,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      textAlign: 'center',

      marginTop: SIZES.titleMt,
      minHeight: SIZES.titleHeight,
      marginBottom: SIZES.titleMb,
      // ...makeDebugBorder('red'),
    },
    mainContainer: {
      width: '100%',
      paddingHorizontal: 20,
    },

    settingItem: {
      width: '100%',
      height: SIZES.ITEM_HEIGHT,
      paddingTop: 18,
      paddingBottom: 18,
      paddingHorizontal: 12,
      backgroundColor: !ctx?.isLight
        ? colors['neutral-card1']
        : colors['neutral-bg1'],
      borderRadius: 8,

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    notFirstOne: {
      marginTop: SIZES.ITEM_GAP,
    },
    leftCol: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    labelIcon: { width: 18, height: 18 },
    iconWrapper: {
      width: 18,
      height: 18,
      marginRight: 8,
    },
    settingItemLabel: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
    },
  };
});
