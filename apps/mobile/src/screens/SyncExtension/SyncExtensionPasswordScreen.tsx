import { useEffect, useState } from 'react';
import { useScanner } from '../Scanner/ScannerScreen';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import {
  apisHomeTabIndex,
  resetNavigationTo,
  useRabbyAppNavigation,
} from '@/hooks/navigation';
import { SyncExtensionHeader } from './components/Header';
import { NextInput } from '@/components2024/Form/Input';
import {
  contactService,
  keyringService,
  preferenceService,
  whitelistService,
} from '@/core/services';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { decryptWithDetail } from '@metamask/browser-passworder';
import { toast } from '@/components2024/Toast';
import { useBiometrics } from '@/hooks/biometrics';
import { apisLock } from '@/core/apis';
import { RootNames } from '@/constant/layout';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { setWhitelist } from '@/hooks/whitelist';
import { usePinAddresses } from '@/hooks/account';
import useAsync from 'react-use/lib/useAsync';
import { NoNewAddressesModal } from './components/NoNewAddresses';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { Text } from '@/components/Typography';
import { mergeWhitelistAddresses } from '@/utils/whitelist';
import { ensureWalletUnlockedForAction } from '@/utils/walletUnlock';

export const SyncExtensionPasswordScreen = () => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { text, clear } = useScanner();
  const [password, setPassword] = useState('');
  const navigation = useRabbyAppNavigation();
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const {
    computed: { defaultTypeLabel, couldSetupBiometrics },
    toggleBiometrics,
  } = useBiometrics({ autoFetch: true });

  const [biometricsEnabled, setBiometricsEnabled] = useState(
    couldSetupBiometrics ?? true,
  );

  const { togglePinAddressAsync } = usePinAddresses();

  const [noAddrVisible, setNoAddrVisible] = useState(false);

  useEffect(() => {
    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_SHOW_PASSWORD,
    );

    return () => {
      clear();
      setNoAddrVisible(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setUpPassword = async () => {
    const result = await apisLock.resetPasswordOnUI(password);
    if (result.error) {
      toast.show(result.error);
      return false;
    } else {
      try {
        await toggleBiometrics?.(biometricsEnabled, {
          validatedPassword: password,
        });
        return true;
      } catch (e) {
        toast.show(t('page.createPassword.biometricsFail'));
      }
    }
  };

  const { value: _shouldSetupPassword, loading: shouldSetupPasswordLoading } =
    useAsync(() => apisLock.shouldAskSetPassword());

  const shouldSetupPassword =
    !!_shouldSetupPassword && !shouldSetupPasswordLoading;

  const syncOther = async ({
    allAccounts,
    whitelist,
    alianNames,
    highligtedAddresses,
  }: {
    allAccounts: Awaited<
      ReturnType<typeof keyringService.getAllVisibleAccountsArray>
    >;
    whitelist: string[];
    alianNames: { name: string; address: string }[];
    highligtedAddresses: {
      brandName: string;
      address: string;
    }[];
  }) => {
    const currentWhitelist = whitelistService.getWhitelist();
    const mergedWhitelist = mergeWhitelistAddresses(
      currentWhitelist,
      whitelist,
    );
    const didSyncWhitelist = mergedWhitelist.length !== currentWhitelist.length;
    const nextPinnedAddresses = [...preferenceService.getPinAddresses()];
    let didSyncAlias = false;
    let didSyncPinnedAddress = false;

    if (didSyncWhitelist) {
      await setWhitelist(mergedWhitelist);
    }

    for (const account of allAccounts) {
      const isInPinned = highligtedAddresses.some(
        pinned =>
          isSameAddress(pinned.address, account.address) &&
          pinned.brandName === account.brandName,
      );
      const isAlreadyPinned = nextPinnedAddresses.some(
        pinned =>
          isSameAddress(pinned.address, account.address) &&
          pinned.brandName === account.brandName,
      );

      if (isInPinned && !isAlreadyPinned) {
        await togglePinAddressAsync({
          brandName: account.brandName,
          address: account.address,
          nextPinned: true,
        });
        nextPinnedAddresses.unshift({
          brandName: account.brandName,
          address: account.address,
        });
        didSyncPinnedAddress = true;
      }

      const aliasName = alianNames.find(alias =>
        isSameAddress(alias.address, account.address),
      )?.name;

      if (aliasName) {
        const currentAlias = contactService.getAliasByAddress(account.address);

        if (currentAlias?.alias !== aliasName) {
          contactService.updateAlias({
            address: account.address,
            name: aliasName,
          });
          didSyncAlias = true;
        }
      }
    }

    return {
      didSyncMetadata: didSyncWhitelist || didSyncAlias || didSyncPinnedAddress,
    };
  };

  const finishMetadataOnlySync = () => {
    clear();
    toast.success(t('page.syncExtension.importedSuccessfully'));
    resetNavigationTo(navigation, 'Home');
    apisHomeTabIndex.setTabIndex(0);
    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_DONE,
    );
  };

  const finishAccountSync = ({
    newAccounts,
  }: {
    newAccounts: Awaited<ReturnType<typeof keyringService.syncExtensionData>>;
  }) => {
    clear();
    navigation.reset({
      index: 0,
      routes: [
        {
          name: RootNames.StackAddress,
          params: {
            screen: RootNames.SyncExtensionAccountSuccess,
            params: {
              newAccounts: newAccounts,
            },
          },
        },
      ],
    });
    apisHomeTabIndex.setTabIndex(0);
  };

  const handleConfirm = async () => {
    if (!text) {
      clear();
      navigation.replace(RootNames.Scanner, { syncExtension: true });
      return;
    }

    setLoading(true);

    try {
      const {
        vault: encryptoVault,
        whitelist,
        highligtedAddresses,
        alianNames,
      } = JSON.parse(text) as {
        vault: Object;
        whitelist: string[];
        alianNames: { name: string; address: string }[];
        highligtedAddresses: {
          brandName: string;
          address: string;
        }[];
      };

      if (!password) {
        setError(t('page.unlock.password.error'));
        setLoading(false);
        return;
      }

      const { vault } = await decryptWithDetail(
        password,
        JSON.stringify(encryptoVault),
      );

      preferenceService.setReportActionTs(
        REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_CONFIRM,
      );

      const shouldAsk = await apisLock.shouldAskSetPassword();

      if (shouldAsk) {
        const success = await setUpPassword();

        if (!success) {
          setLoading(false);
          return;
        }

        toast.success(t('page.createPassword.setUpSuccess'));
      } else if (!(await ensureWalletUnlockedForAction())) {
        setLoading(false);
        return;
      }

      const newAccounts = await keyringService.syncExtensionData(vault as any);
      const allAccounts = await keyringService.getAllVisibleAccountsArray();
      const { didSyncMetadata } = await syncOther({
        allAccounts,
        whitelist,
        alianNames,
        highligtedAddresses,
      });

      if (newAccounts.length) {
        finishAccountSync({ newAccounts });
      } else if (didSyncMetadata) {
        finishMetadataOnlySync();
      } else {
        setNoAddrVisible(true);
      }
    } catch (caughtError) {
      setError(String(caughtError));
      console.error('appEncryptor.decrypt error', caughtError);
    }

    setLoading(false);
  };

  return (
    <>
      <FooterButtonScreenContainer
        as="View"
        buttonProps={{
          title: t('global.Confirm'),
          onPress: handleConfirm,
          loading: loading,
        }}
        style={styles.screen}
        footerBottomOffset={56}
        footerContainerStyle={{
          paddingHorizontal: 20,
        }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <SyncExtensionHeader type="verify" newUser={shouldSetupPassword} />
            <NextInput.Password
              // initialPasswordVisible
              as={'TextInput'}
              fieldName="Enter the Password to Confirm"
              containerStyle={Object.assign(
                {},
                error
                  ? {}
                  : {
                      borderColor: 'transparent',
                    },
              )}
              iconColor={colors2024['neutral-title-1']}
              inputProps={{
                value: password,
                secureTextEntry: true,
                inputMode: 'text',
                returnKeyType: 'done',
                placeholderTextColor: colors2024['neutral-foot'],
                onChangeText: v => {
                  setPassword(v);
                  setError('');
                },
              }}
              style={[
                styles.passwordStyle,
                !error && { borderColor: 'transparent' },
              ]}
              fieldNameStyle={styles.fieldName}
              hasError={Boolean(error)}
              fieldErrorContainerStyle={styles.fieldErrorContainerStyle}
              tipText={error ?? null}
            />

            {shouldSetupPassword ? (
              <View style={styles.switchContainer}>
                <Text style={styles.labelText}>
                  {t('page.createPassword.enable', {
                    bioType: defaultTypeLabel,
                  })}
                </Text>
                <View style={styles.valueView}>
                  <AppSwitch2024
                    value={biometricsEnabled}
                    onValueChange={async value => {
                      if (!couldSetupBiometrics) {
                        toast.show(
                          t('page.createPassword.phoneNotSupport', {
                            bioType: defaultTypeLabel,
                          }),
                        );
                        return;
                      }
                      setBiometricsEnabled(value);
                    }}
                  />
                </View>
              </View>
            ) : null}
          </View>
        </TouchableWithoutFeedback>
      </FooterButtonScreenContainer>
      <NoNewAddressesModal
        onCancel={() => setNoAddrVisible(false)}
        onConfirm={() => setNoAddrVisible(false)}
        visible={noAddrVisible}
      />
    </>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  container: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    height: '100%',
    width: '100%',
    paddingHorizontal: 20,
  },
  passwordStyle: {
    marginTop: 36,
    height: 62,
    borderRadius: 16,
  },
  fieldName: {
    color: ctx.colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 16,
  },
  fieldErrorContainerStyle: {
    marginTop: 8,
    width: '100%',
  },
  switchContainer: {
    // width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 8,
  },
  labelText: {
    width: '50%',
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-title-1'],
  },
  valueView: {
    width: '50%',
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
}));
