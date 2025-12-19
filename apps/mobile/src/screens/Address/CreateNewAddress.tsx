import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useCallback, useState } from 'react';

import {
  StyleSheet,
  View,
  Text,
  StyleProp,
  TextStyle,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ProgressBar } from '@/components2024/progressBar';
import { Button } from '@/components2024/Button';
import { apiMnemonic } from '@/core/apis';
import { activeAndPersistAccountsByMnemonics } from '@/core/apis/mnemonic';
import useAsync from 'react-use/lib/useAsync';
import { ellipsisAddress } from '@/utils/address';
import { contactService, keyringService } from '@/core/services';
import { Skeleton } from '@rneui/themed';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { StackActions, useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import LinearGradient from 'react-native-linear-gradient';
import { replaceToFirst } from '@/utils/navigation';
import { useCreateAddressProc } from '@/hooks/address/useNewUser';
import HeaderTitleText2024 from '@/components2024/ScreenHeader/HeaderTitleText';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';

const MAX_ACCOUNT_COUNT = 50;
const PROGRESS_BAR_STEP = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
};

function MainListBlocks() {
  const { t } = useTranslation();
  const [newAddress, setNewAddress] = useState('');
  const { styles } = useTheme2024({ getStyle });
  const navigation = useRabbyAppNavigation();
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const route =
    useRoute<
      GetNestedScreenRouteProp<'AddressNavigatorParamList', 'CreateNewAddress'>
    >();
  const state = route.params;

  const getHeaderTitle = React.useCallback(() => {
    return (
      <HeaderTitleText2024 style={styles.title}>
        {state?.title || state?.isFirstCreate
          ? t('screens.addressStackTitle.CreateNewAddress')
          : t('screens.addressStackTitle.ConfrimAddress')}
      </HeaderTitleText2024>
    );
  }, [state?.isFirstCreate, state?.title, styles.title, t]);

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
    });
  }, [setNavigationOptions, getHeaderTitle, state?.title]);

  const { value, loading, error } = useAsync(async () => {
    let seedPhrase = '';
    let accountsToCreate: any[] | undefined = [];
    if (state?.mnemonics) {
      seedPhrase = state?.mnemonics;
      const currentAddressArr = state?.accounts;
      const api = apiMnemonic.getKeyringByMnemonic(seedPhrase, '');
      for (let i = 0; i < MAX_ACCOUNT_COUNT; i++) {
        console.log('requestKeyring res find count', i);
        const res = await api?.getAddresses(i, i + 1);
        const idx = currentAddressArr?.findIndex(
          item => item === res?.[0].address,
        );
        if (idx === -1) {
          accountsToCreate = res;
          break; // has find a address
        }
      }
    } else {
      // first create
      seedPhrase = await apiMnemonic.generatePreMnemonic();
      const Keyring = keyringService.getKeyringClassForType(
        KEYRING_CLASS.MNEMONIC,
      ) as any;
      const keyring = new Keyring({ mnemonic: seedPhrase, passphrase: '' });
      accountsToCreate = keyring?.getAddresses(0, 1);
    }
    const words = seedPhrase.split(' ');
    const address = accountsToCreate?.[0].address;
    setNewAddress(address);
    return {
      seedPhrase,
      words,
      accountsToCreate,
      addressIndex: accountsToCreate?.[0].index,
    };
  });

  const WalletAddress = useCallback(
    ({ style }: { style?: StyleProp<TextStyle> }) => {
      return (
        <Text style={StyleSheet.flatten([styles.addressText, style])}>
          {ellipsisAddress(newAddress)}
        </Text>
      );
    },
    [styles.addressText, newAddress],
  );

  const { storeSeedPharse, storeAddressList } = useCreateAddressProc();
  const handleContinue = useCallback(() => {
    storeAddressList([
      {
        address: newAddress,
        aliasName: '',
        index: value?.addressIndex,
      },
    ]);
    console.log('exe handleContinue');

    if (value?.seedPhrase) {
      storeSeedPharse(value?.seedPhrase);
    }

    if (state?.noSetupPassword) {
      navigation.dispatch(
        StackActions.push(RootNames.StackAddress, {
          screen: RootNames.CreateChooseBackup,
          params: {},
        }),
      );
    } else {
      navigation.replace(RootNames.StackAddress, {
        screen: RootNames.SetPassword2024,
        params: {
          finishGoToScreen: RootNames.CreateChooseBackup,
          delaySetPassword: true,
          isFirstCreate: !!state?.isFirstCreate,
        },
      });
    }
  }, [newAddress, value, navigation, state, storeSeedPharse, storeAddressList]);

  const handleDone = useCallback(async () => {
    contactService.setAlias({
      address: newAddress,
      alias: '',
    });
    await activeAndPersistAccountsByMnemonics(
      state?.mnemonics || '',
      '',
      value?.accountsToCreate || [],
      false,
    );
    replaceToFirst(RootNames.StackAddress, {
      screen: RootNames.ImportSuccess2024,
      params: {
        type: KEYRING_TYPE.HdKeyring,
        brandName: KEYRING_CLASS.MNEMONIC,
        isFirstCreate: true,
        address: [newAddress],
        mnemonics: state?.mnemonics,
        passphrase: '',
        isExistedKR: false,
        alias: ellipsisAddress(newAddress),
      },
    });
  }, [newAddress, state, value]);

  const currentProgressCount = React.useMemo(() => {
    return state?.useCurrentSeed
      ? PROGRESS_BAR_STEP.THREE
      : state?.noSetupPassword
      ? PROGRESS_BAR_STEP.TWO
      : PROGRESS_BAR_STEP.ONE;
  }, [state]);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <View style={[styles.container]}>
        {!!state?.isFirstCreate && (
          <ProgressBar
            amount={PROGRESS_BAR_STEP.THREE}
            currentCount={currentProgressCount}
          />
        )}
        <Text style={[styles.text]}>
          {t('page.nextComponent.createNewAddress.addressTopTips')}
        </Text>
        <WalletIcon
          style={styles.icon}
          address={newAddress}
          width={66}
          height={66}
        />
        {loading ? (
          <Skeleton
            circle
            width={254}
            height={42}
            animation="wave"
            LinearGradientComponent={LinearGradient}
            style={[styles.item1]}
          />
        ) : (
          <WalletAddress style={styles.walletAddress} />
        )}
        <Button
          disabled={loading}
          containerStyle={styles.btnContainer}
          type="primary"
          title={t('page.nextComponent.createNewAddress.Continue')}
          onPress={state?.useCurrentSeed ? handleDone : handleContinue}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

function CreateNewAddress(): JSX.Element {
  const { colors2024 } = useTheme2024({ getStyle });
  return (
    <NormalScreenContainer
      overwriteStyle={{
        backgroundColor: colors2024['neutral-bg-1'],
      }}>
      <MainListBlocks />
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  item1: {
    marginTop: 10,
  },
  icon: {
    marginTop: 29,
    marginBottom: 0,
    borderRadius: 16,
  },
  btnContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 56,
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontSize: 17,
    marginTop: 34,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  container: {
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  addressText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  walletAddress: {
    marginTop: 10,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
  },
}));

export default CreateNewAddress;
