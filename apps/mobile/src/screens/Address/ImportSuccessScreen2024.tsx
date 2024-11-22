import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { contactService, preferenceService } from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import {
  useIsFocused,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native';
import React, { useCallback, useState } from 'react';

import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextInput,
  TextStyle,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { Card } from '@/components2024/Card';
import { NextInput } from '@/components2024/Form/Input';
import { useAccounts, useCurrentAccount } from '@/hooks/account';
import { addressUtils } from '@rabby-wallet/base-utils';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { matomoRequestEvent } from '@/utils/analytics';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKRCategoryByType } from '@/utils/transaction';
import { Chain } from '@/constant/chains';
import { Button } from '@/components2024/Button';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { ellipsisAddress } from '@/utils/address';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';
import { GnosisSupportChainList } from './ImportSafeAddressScreen2024';
import Lottie from 'lottie-react-native';
import AnimationImportSuccess from '@/assets2024/animations/animation-import-success.json';
import RcIconRightCC from '@/assets2024/icons/common/right-2.svg';
import { navigate } from '@/utils/navigation';

type ImportSuccessScreenProps = NativeStackScreenProps<RootStackParamsList>;

const DisMissKBWrapper = ({ children }) => (
  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    {children}
  </TouchableWithoutFeedback>
);

export const ImportSuccessScreen2024 = () => {
  const inputRef = React.useRef<TextInput>(null);
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const navigation = useNavigation<ImportSuccessScreenProps['navigation']>();
  const [animationFinished, setAnimationFinished] = useState(false);

  const state = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.ImportSuccess2024)?.params,
  ) as {
    address: string | string[];
    brandName: string;
    deepLink: string;
    isFirstImport: boolean;
    isFirstCreate: boolean;
    type: KEYRING_TYPE;
    supportChainList?: Chain[];
    mnemonics?: string;
    passphrase?: string;
    alias?: string;
    keyringId?: number;
  };
  const [importAddresses, setImportAddresses] = React.useState<
    {
      address: string;
      aliasName: string;
    }[]
  >([]);

  const { switchAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });

  const handleDone = React.useCallback(() => {
    importAddresses.forEach(item => {
      contactService.setAlias({
        address: item.address,
        alias: item.aliasName,
      });
    });
    Keyboard.dismiss();

    navigation.reset({
      index: 0,
      routes: [
        {
          name: RootNames.StackAddress,
          params: {
            screen: RootNames.MultiAddressHome,
          },
        },
      ],
    });
  }, [importAddresses, navigation]);

  const isFocus = useIsFocused();

  React.useEffect(() => {
    const addresses = Array.isArray(state?.address)
      ? state?.address
      : [state?.address];

    setImportAddresses(
      addresses.map(address => ({
        address,
        aliasName:
          state?.alias ||
          contactService.getAliasByAddress(address)?.alias ||
          ellipsisAddress(address || '') ||
          '',
      })),
    );

    matomoRequestEvent({
      category: 'Import Address',
      action: `Success_Import_${getKRCategoryByType(state?.type)}`,
      label: state?.brandName,
    });
  }, [state]);

  React.useEffect(() => {
    setTimeout(() => fetchAccounts(), 0);
  }, [fetchAccounts]);

  React.useEffect(() => {
    if (!importAddresses.length) {
      return;
    }
    const lastAddress = importAddresses[importAddresses.length - 1].address;
    if (isFocus) {
      const targetAccount = accounts.find(
        a =>
          a.brandName === state?.brandName &&
          addressUtils.isSameAddress(a.address, lastAddress),
      );
      const currentAccount = preferenceService.getCurrentAccount();
      if (targetAccount) {
        if (
          !currentAccount ||
          targetAccount.brandName !== currentAccount.brandName ||
          !addressUtils.isSameAddress(currentAccount.address, lastAddress)
        ) {
          switchAccount(targetAccount);
        }
      }
    }
  }, [isFocus, state, accounts, switchAccount, importAddresses]);

  const WalletAddress = useCallback(
    ({ address, style }: { address: string; style?: StyleProp<TextStyle> }) => {
      return (
        <Text style={StyleSheet.flatten([styles.addressText, style])}>
          {ellipsisAddress(address)}
        </Text>
      );
    },
    [styles.addressText],
  );

  const handleImportMore = () => {
    if (!state.isFirstImport) {
      return;
    }
    // TODO: replace to Modal
    navigate(RootNames.ImportMoreAddress, {
      type: state.type,
      brand: state.brandName,
      mnemonics: state.mnemonics,
      passphrase: state.passphrase,
      keyringId: state.keyringId,
    });
  };

  const Wrapper =
    importAddresses.length > 1 ? KeyboardAvoidingView : DisMissKBWrapper;

  return (
    <Wrapper>
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.animationLayer}>
          <Lottie
            source={AnimationImportSuccess}
            style={[
              styles.animationLottie,
              animationFinished && styles.hideAnimation,
            ]}
            onAnimationFinish={() => {
              setTimeout(() => {
                inputRef.current?.focus();
                setAnimationFinished(true);
              }, 500);
            }}
            onAnimationFailure={() => {
              setTimeout(() => {
                inputRef.current?.focus();
                setAnimationFinished(true);
              }, 500);
            }}
            // duration={3000}
            loop={false}
            autoPlay
            {...(__DEV__ &&
              {
                // duration: 5000,
                // loop: true,
              })}
          />
        </View>
        <View style={styles.addressList}>
          {importAddresses.length === 1 ? (
            <View style={styles.itemContainer}>
              <WalletIcon
                type={state?.type}
                width={100}
                height={100}
                style={styles.icon}
              />
              <NextInput
                containerStyle={styles.inputContainer}
                inputStyle={styles.inputInner}
                ref={inputRef}
                inputProps={{
                  showSoftInputOnFocus: false,
                  editable: !state?.isFirstCreate,
                  value: importAddresses?.[0]?.aliasName || '',
                  inputMode: 'text',
                  returnKeyType: 'done',
                  textAlign: 'center',
                  placeholder: ellipsisAddress(
                    importAddresses?.[0]?.address || '',
                  ),
                  blurOnSubmit: true,
                  placeholderTextColor: colors2024['neutral-info'],
                  onChangeText(text) {
                    const newImportAddresses = [...importAddresses];
                    newImportAddresses[0] = {
                      address: importAddresses?.[0]?.address || '',
                      aliasName: text,
                    };
                    setImportAddresses(newImportAddresses);
                  },
                }}
              />
              <WalletAddress address={importAddresses?.[0]?.address || ''} />
              {state?.supportChainList?.length ? (
                <GnosisSupportChainList
                  data={state?.supportChainList}
                  style={{ marginBottom: 12 }}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.scrollList}>
              <ScrollView
                scrollEnabled
                showsVerticalScrollIndicator={false}
                onResponderRelease={() => Keyboard.dismiss()}
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}>
                {importAddresses.map((item, index) => (
                  <Card key={item.address} style={styles.addressItem}>
                    <WalletIcon type={state?.type} width={50} height={50} />
                    <View>
                      <TextInput
                        style={styles.listInput}
                        value={item.aliasName}
                        ref={index === 0 ? inputRef : null}
                        onChange={nativeEvent => {
                          const _aliasName = nativeEvent.nativeEvent.text;
                          const newImportAddresses = [...importAddresses];
                          newImportAddresses[index] = {
                            address: item.address,
                            aliasName: _aliasName,
                          };
                          setImportAddresses(newImportAddresses);
                        }}
                        placeholder={ellipsisAddress(item.address)}
                        placeholderTextColor={colors2024['neutral-info']}
                        blurOnSubmit
                      />
                      <WalletAddress address={item.address} />
                    </View>
                  </Card>
                ))}
              </ScrollView>
            </View>
          )}
          <Text style={styles.resultTip}>
            {importAddresses.length > 1
              ? `${importAddresses.length} Addresses`
              : ''}
            &nbsp;{state?.isFirstCreate ? 'Created' : 'Imported'} successfully!
          </Text>
        </View>

        {state.isFirstImport && (
          <TouchableOpacity
            onPress={handleImportMore}
            style={styles.ledgerButton}>
            <Text style={styles.ledgerButtonText}>Import more addresses</Text>
            <RcIconRightCC
              width={16}
              height={16}
              color={colors2024['blue-default']}
            />
          </TouchableOpacity>
        )}
        <Button
          containerStyle={styles.btnContainer}
          type="primary"
          title="Done"
          noShadow={true}
          onPress={handleDone}
        />
      </View>
    </Wrapper>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  const winLayout = Dimensions.get('window');

  return {
    container: {
      width: '100%',
      height: '100%',
      position: 'relative',
      display: 'flex',
      paddingHorizontal: 20,
      backgroundColor: colors2024['neutral-bg-1'],
      marginBottom: 20,
    },
    animationLayer: {
      width: winLayout.width,
      height: '100%',
      minHeight: winLayout.height,
      // ...makeDevOnlyStyle({
      //   backgroundColor: 'blue',
      // }),
      position: 'absolute',
      zIndex: 999,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    animationLottie: {
      width: '100%',
      height: '100%',
    },
    hideAnimation: { display: 'none' },
    addressList: {
      display: 'flex',
      justifyContent: 'center',
      flex: 1,
      alignItems: 'center',
    },
    scrollList: {
      width: '100%',
      maxHeight: '60%',
    },
    itemContainer: {
      display: 'flex',
      alignItems: 'center',
    },
    icon: {
      borderRadius: 24,
    },
    addressText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '400',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    inputContainer: {
      width: '100%',
      height: 72,
      padding: 0,
      margin: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    inputInner: {
      width: '100%',
      marginTop: 15,
      textAlignVertical: 'center',
      height: 54,
      padding: 0,
      fontSize: 36,
      borderWidth: 0,
      backgroundColor: 'transparent',
      lineHeight: 42,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      textAlign: 'center',
    },
    resultTip: {
      width: '100%',
      marginTop: 28,
      fontWeight: '800',
      fontSize: 20,
      lineHeight: 24,
      textAlign: 'center',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['brand-default'],
    },
    btnContainer: {
      width: '100%',
      marginBottom: 56,
    },
    addressItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 11,
      marginBottom: 12,
      width: '100%',
    },
    listInput: {
      width: '100%',
      textAlignVertical: 'center',
      padding: 0,
      fontSize: 18.8,
      borderWidth: 0,
      backgroundColor: 'transparent',
      lineHeight: 25,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      textAlign: 'left',
      marginBottom: 4,
    },
    fire: {
      width: 134,
      height: 134,
      position: 'absolute',
      bottom: 149,
      left: '50%',
      transform: [{ translateX: -50 }],
    },
    ledgerButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 25,
    },
    ledgerButtonText: {
      color: colors2024['brand-default'],
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
  };
});
