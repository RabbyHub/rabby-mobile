import { useTheme2024 } from '@/hooks/theme';
import React, { useMemo, useCallback, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import HdKeyring from '@rabby-wallet/eth-hd-keyring';
import { navigateDeprecated } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useScanner } from '../Scanner/ScannerScreen';
import { useFocusEffect } from '@react-navigation/native';
import * as import_english from '@scure/bip39/wordlists/english';
import PasteButton from '@/components2024/PasteButton';
import { NextInput } from '@/components2024/Form/Input';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Keyboard,
  Pressable,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as ethUtil from 'ethereumjs-util';
import { RcIconScannerCC } from '@/assets/icons/address';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import {
  isNewlyInputTextSameWithContentFromClipboard,
  onPastedSensitiveData,
} from '@/utils/clipboard';
import { Text } from '@/components/Typography';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';

type TabType = 'seedPhrase' | 'privateKey';

type ScreenProps = NativeStackScreenProps<RootStackParamsList, 'StackAddress'>;

export const ImportSecret = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const navigation = useNavigation<ScreenProps['navigation']>();

  const [activeTab, setActiveTab] = React.useState<TabType>('seedPhrase');

  // Seed phrase state
  const [mnemonics, setMnemonics] = React.useState<string>('');
  const [mnemonicError, setMnemonicError] = React.useState<string>();

  // Private key state
  const [privateKey, setPrivateKey] = React.useState<string>('');
  const [privateKeyError, setPrivateKeyError] = React.useState<string>();

  const scanner = useScanner();

  const formatMnemonics = useMemo(() => {
    const trimMnemonics = mnemonics?.trim();
    const splitMnemonics = trimMnemonics.split(/\s+|,|\n/).filter(Boolean);
    return splitMnemonics.join(' ');
  }, [mnemonics]);

  // Derived values based on active tab
  const inputPlaceholder = useMemo(() => {
    return activeTab === 'seedPhrase'
      ? t('page.newUserOnboarding.importSecret.seedPhrasePlaceholder')
      : t('page.newUserOnboarding.importSecret.privateKeyPlaceholder');
  }, [activeTab, t]);

  const inputValue = activeTab === 'seedPhrase' ? mnemonics : privateKey;
  const inputError =
    activeTab === 'seedPhrase' ? mnemonicError : privateKeyError;

  // Clear errors when switching tabs
  const handleTabChange = React.useCallback((tab: TabType) => {
    setActiveTab(tab);
    setMnemonicError(undefined);
    setPrivateKeyError(undefined);
  }, []);

  // Handle input change
  const handleInputChange = React.useCallback(
    (text: string) => {
      if (activeTab === 'seedPhrase') {
        setMnemonicError(undefined);
        setMnemonics(text);
        isNewlyInputTextSameWithContentFromClipboard(text).then(isSame => {
          if (isSame) {
            onPastedSensitiveData({ type: 'seedPhrase' });
          }
        });
      } else {
        setPrivateKeyError(undefined);
        setPrivateKey(text);
        isNewlyInputTextSameWithContentFromClipboard(text).then(isSame => {
          if (isSame) {
            onPastedSensitiveData({ type: 'privateKey' });
          }
        });
      }
    },
    [activeTab],
  );

  // Handle paste
  const handlePaste = React.useCallback(
    (text: string) => {
      if (activeTab === 'seedPhrase') {
        setMnemonicError(undefined);
        setMnemonics(text);
        onPastedSensitiveData({ type: 'seedPhrase' });
      } else {
        setPrivateKeyError(undefined);
        setPrivateKey(text);
        onPastedSensitiveData({ type: 'privateKey' });
      }
    },
    [activeTab],
  );

  // Navigate to CreateNewWallet
  const handleCreateNewWallet = React.useCallback(() => {
    navigation.navigate(RootNames.StackAddress, {
      screen: RootNames.CreateNewWallet,
    });
  }, [navigation]);

  // Tab toggle component for header
  const TabToggle = useCallback(() => {
    return (
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'seedPhrase' && styles.tabActive]}
          onPress={() => handleTabChange('seedPhrase')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'seedPhrase' && styles.tabTextActive,
            ]}>
            {t('page.manageAddress.seed-phrase')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'privateKey' && styles.tabActive]}
          onPress={() => handleTabChange('privateKey')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'privateKey' && styles.tabTextActive,
            ]}>
            {t('page.manageAddress.private-key')}
          </Text>
        </Pressable>
      </View>
    );
  }, [activeTab, handleTabChange, styles, t]);

  // Set custom header with tabs
  useEffect(() => {
    navigation.setOptions({
      headerTitle: TabToggle,
      headerTitleAlign: 'center',
    });
  }, [navigation, TabToggle]);

  const verifyMnemonics = React.useCallback(() => {
    try {
      const splitMnemonics = formatMnemonics.split(' ');
      const errorList: Array<{ index: number; word: string }> = [];
      for (let index = 0; index < splitMnemonics.length; index++) {
        const word = splitMnemonics[index];
        let v = word?.trim();
        if (v && !import_english.wordlist.includes(v)) {
          errorList.push({
            index,
            word: v,
          });
        }
      }

      if (errorList.length) {
        setMnemonicError(
          `${t('background.error.errorWords', {
            count: errorList.length,
          })}: ${errorList.map(i => i.word).join(',')}`,
        );
        return false;
      }
      if (!HdKeyring.validateMnemonic(formatMnemonics)) {
        setMnemonicError(t('background.error.invalidMnemonic'));
        return false;
      }
      return true;
    } catch {
      setMnemonicError(t('background.error.invalidMnemonic'));
      return false;
    }
  }, [formatMnemonics, t]);

  const verifyPrivateKey = React.useCallback(() => {
    const privateKeyPrefix = ethUtil.stripHexPrefix(privateKey);
    const buffer = Buffer.from(privateKeyPrefix, 'hex');
    try {
      if (!ethUtil.isValidPrivate(buffer)) {
        setPrivateKeyError(t('background.error.invalidPrivateKey'));
        return false;
      }
      return true;
    } catch {
      setPrivateKeyError(t('background.error.invalidPrivateKey'));
      return false;
    }
  }, [privateKey, t]);

  // Handle confirm button - navigate to CreateNewWallet with import data
  const handleConfirm = React.useCallback(async () => {
    if (activeTab === 'seedPhrase') {
      if (!verifyMnemonics()) {
        return;
      }

      // Navigate to CreateNewWallet with import data
      navigation.navigate(RootNames.StackAddress, {
        screen: RootNames.CreateNewWallet,
        params: {
          seedPhrase: formatMnemonics,
        },
      });
    } else {
      if (!verifyPrivateKey()) {
        return;
      }

      // Navigate to CreateNewWallet with import data
      navigation.navigate(RootNames.StackAddress, {
        screen: RootNames.CreateNewWallet,
        params: {
          privateKey,
        },
      });
    }
  }, [
    activeTab,
    formatMnemonics,
    privateKey,
    verifyMnemonics,
    verifyPrivateKey,
    navigation,
  ]);

  // Handle scanner result
  React.useEffect(() => {
    if (scanner.text) {
      if (activeTab === 'seedPhrase') {
        setMnemonics(scanner.text);
      } else {
        setPrivateKey(scanner.text);
      }
      scanner.clear();
    }
  }, [scanner, activeTab]);

  useFocusEffect(() => {
    return () => {
      // Cleanup if needed
    };
  });

  const isConfirmDisabled = React.useMemo(() => {
    if (activeTab === 'seedPhrase') {
      return !formatMnemonics || !!mnemonicError;
    }
    return !privateKey || !!privateKeyError;
  }, [activeTab, formatMnemonics, mnemonicError, privateKey, privateKeyError]);

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('global.Confirm'),
        onPress: handleConfirm,
        disabled: isConfirmDisabled,
      }}
      style={styles.screen}
      footerBottomOffset={48}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.topContent}>
              {/* Input Area */}
              <NextInput.TextArea
                style={styles.textContainer}
                tipText={inputError}
                hasError={!!inputError}
                inputStyle={styles.textArea}
                containerStyle={Object.assign(
                  {},
                  inputError
                    ? {}
                    : {
                        borderColor: 'transparent',
                      },
                )}
                inputProps={{
                  placeholder: inputPlaceholder,
                  value: inputValue,
                  secureTextEntry: true,
                  textContentType: 'none',
                  blurOnSubmit: true,
                  returnKeyType: 'done',
                  onChangeText: handleInputChange,
                }}
                customIcon={ctx => (
                  <TouchableOpacity
                    style={ctx.wrapperStyle}
                    onPress={() => {
                      navigateDeprecated(RootNames.Scanner);
                    }}>
                    <RcIconScannerCC
                      style={ctx.iconStyle}
                      color={colors2024['neutral-title-1']}
                    />
                  </TouchableOpacity>
                )}
              />

              <PasteButton style={styles.pasteButton} onPaste={handlePaste} />
            </View>
          </View>

          {/* Create New Wallet Link */}
          <View style={styles.linkWrapper}>
            <Text style={styles.linkText}>
              <Trans
                i18nKey="page.newUserOnboarding.common.orYouCanCreateNewWallet"
                t={t}
                components={{
                  clickable: (
                    <Text
                      style={styles.linkTextHighlight}
                      onPress={handleCreateNewWallet}
                    />
                  ),
                }}
              />
            </Text>
          </View>
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
    flex: 1,
    position: 'relative',
    height: '100%',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  topContent: {
    alignItems: 'center',
    width: '100%',
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tab: {
    height: 34,
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: ctx.colors2024['brand-light-1'],
  },
  tabText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: ctx.colors2024['neutral-secondary'],
  },
  tabTextActive: {
    color: ctx.colors2024['brand-default'],
    fontWeight: '700',
  },
  textContainer: {
    marginTop: 0,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  textArea: {
    marginTop: 14,
    paddingHorizontal: 20,
  },
  pasteButton: {
    marginTop: 50,
  },
  error: {
    textAlign: 'left',
  },
  linkWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  linkText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: ctx.colors2024['neutral-secondary'],
  },
  linkTextHighlight: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: ctx.colors2024['brand-default'],
  },
}));
