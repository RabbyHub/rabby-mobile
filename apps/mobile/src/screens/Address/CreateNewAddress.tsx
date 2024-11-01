import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useCallback, useRef, useState } from 'react';

import {
  StyleSheet,
  View,
  Text,
  TextInput,
  StyleProp,
  TextStyle,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';

import { default as RcSeedPhrase } from '@/assets/icons/nextComponent/IconSeedPhrase.svg';
import { RootNames } from '@/constant/layout';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ProgressBar } from '@/components2024/progressBar';
import { Button } from '@/components2024/Button';
import { apiMnemonic } from '@/core/apis';
import { generateKeyringWithMnemonic } from '@/core/apis/mnemonic';
import { requestKeyring } from '@/core/apis/keyring';
import useAsync from 'react-use/lib/useAsync';
import { ellipsisAddress } from '@/utils/address';
import { contactService } from '@/core/services';
import { navigate } from '@/utils/navigation';

function MainListBlocks() {
  const { t } = useTranslation();
  const [newAddress, setNewAddress] = useState('');
  const [addressAlias, setAddressAlias] = useState('Seed Phrase 1 #1');
  const { styles } = useTheme2024({ getStyle });

  const { value, loading, error } = useAsync(async () => {
    const seedPhrase: string = await apiMnemonic.generatePreMnemonic();
    const words = seedPhrase.split(' ');
    const { keyringId } = await generateKeyringWithMnemonic(seedPhrase, '');

    const firstAddress = await requestKeyring(
      KEYRING_TYPE.HdKeyring,
      'getAddresses',
      keyringId ?? null,
      0,
      1,
    );

    const address = firstAddress[0].address;
    setNewAddress(address);
    return {
      seedPhrase,
      words,
      firstAddress,
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

  const handleContinue = useCallback(() => {
    contactService.setAlias({
      address: newAddress,
      alias: addressAlias,
    });
    console.log('exe handleContinue');
    navigate(RootNames.StackAddress2024, {
      screen: RootNames.CreateNewAddressSecond,
      params: {
        address: newAddress,
        alias: addressAlias,
        seedPhrase: value?.seedPhrase,
      },
    });
  }, [newAddress, addressAlias, value?.seedPhrase]);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <View style={[styles.container]}>
        <ProgressBar amount={3} currentCount={1} />
        <Text style={[styles.text]}>
          {t('page.nextComponent.createNewAddress.addressTopTips')}
        </Text>
        <RcSeedPhrase style={styles.icon} />
        <TextInput
          style={styles.inputInner}
          value={addressAlias}
          // placeholder={'Seed Phrase 1 #1'}
          onChange={nativeEvent => {
            setAddressAlias(nativeEvent.nativeEvent.text);
          }}
          blurOnSubmit
          autoFocus
          clearButtonMode="while-editing"
        />
        {/* </View> */}
        <WalletAddress />
        <Button
          containerStyle={styles.btnContainer}
          type="primary"
          title={t('page.nextComponent.createNewAddress.Continue')}
          onPress={handleContinue}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

function CreateNewAddress(): JSX.Element {
  return (
    <NormalScreenContainer>
      <MainListBlocks />
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  icon: {
    marginTop: -12,
    marginBottom: -68,
    borderRadius: 16,
  },
  btnContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 60,
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
  inputContainer: {
    marginVertical: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  inputInner: {
    width: '100%',
    textAlignVertical: 'center',
    height: 54,
    padding: 0,
    fontSize: 36,
    border: 0,
    backgroundColor: 'transparent',
    lineHeight: 42,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
}));

export default CreateNewAddress;
