import { useEffect, useState } from 'react';
import { useScanner } from '../Scanner/ScannerScreen';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { Keyboard, Text, TouchableWithoutFeedback, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { SyncExtensionHeader } from './components/Header';
import { NextInput } from '@/components2024/Form/Input';
import { contactService, keyringService } from '@/core/services';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { decryptWithDetail } from './utils';
import { toast } from '@/components2024/Toast';
import { useBiometrics } from '@/hooks/biometrics';
import { apisLock } from '@/core/apis';
import { RootNames } from '@/constant/layout';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { ellipsis } from '@/utils/address';
import { useWhitelist } from '@/hooks/whitelist';
import { usePinAddresses } from '@/hooks/account';
import { DisplayedKeyring } from '@rabby-wallet/keyring-utils';
import useAsync from 'react-use/lib/useAsync';

export const SyncExtensionPasswordScreen = () => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { text, clear } = useScanner();
  const [password, setPassword] = useState('');
  const navigation = useRabbyAppNavigation();
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const {
    computed: { defaultTypeLabel, isBiometricsEnabled, couldSetupBiometrics },
    toggleBiometrics,
  } = useBiometrics({ autoFetch: true });

  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  const { addWhitelist } = useWhitelist();

  const { togglePinAddressAsync } = usePinAddresses();

  useEffect(() => {
    return () => {
      clear();
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

  const syncOther = ({
    newAccounts,
    whitelist,
    alianNames,
    highligtedAddresses,
  }: {
    newAccounts: DisplayedKeyring['accounts'];
    whitelist: string[];
    alianNames: { name: string; address: string }[];
    highligtedAddresses: {
      brandName: string;
      address: string;
    }[];
  }) => {
    newAccounts.forEach(newAccount => {
      const isInWhitelist = (whitelist as string[])?.some(addr =>
        isSameAddress(addr, newAccount?.address),
      );
      const isInPinned = highligtedAddresses.some(
        pinned =>
          isSameAddress(pinned.address, newAccount?.address) &&
          pinned.brandName === newAccount.brandName,
      );

      const aliasName =
        alianNames.find(alias =>
          isSameAddress(alias.address, newAccount.address),
        )?.name || ellipsis(newAccount.address);

      if (isInWhitelist) {
        addWhitelist(newAccount?.address, { hasValidated: true });
      }

      if (isInPinned) {
        togglePinAddressAsync({
          brandName: newAccount?.brandName,
          address: newAccount?.address,
          nextPinned: true,
        });
      }

      if (aliasName) {
        contactService.updateAlias({
          address: newAccount.address,
          name: aliasName,
        });
      }
    });
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

      const { vault } = await decryptWithDetail(
        password,
        JSON.stringify(encryptoVault),
      );

      const shouldAsk = await apisLock.shouldAskSetPassword();

      if (shouldAsk) {
        const success = await setUpPassword();

        if (success) {
          toast.success(t('page.createPassword.setUpSuccess'));
        }
      }

      const newAccounts = await keyringService.syncExtensionData(vault as any);

      if (newAccounts.length) {
        syncOther({
          newAccounts,
          whitelist,
          alianNames,
          highligtedAddresses,
        });

        clear();

        navigation.replace(RootNames.StackAddress, {
          screen: RootNames.SyncExtensionImported,
          params: {
            newAccounts,
          },
        });
      } else {
        // toast.info('Not found more new addresses');
        throw Error('not found more new Addresses');
      }
    } catch (error) {
      setError(String(error));
      console.error('appEncryptor.decrypt error', error);
    }

    setLoading(false);
  };

  return (
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
                {t('page.createPassword.enable', { bioType: defaultTypeLabel })}
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
    paddingLeft: 4,
    marginTop: 8,
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
