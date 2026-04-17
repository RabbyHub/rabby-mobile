import { useTheme2024 } from '@/hooks/theme';
import React, {
  useMemo,
  useCallback,
  useEffect,
  useDeferredValue,
} from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { navigateDeprecated, replaceToFirst } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useScanner } from '../Scanner/ScannerScreen';
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
import { validateAndCleanPrivateKey } from '@/core/apis/privateKey';
import { apiPrivateKey, apiMnemonic } from '@/core/apis';
import { validateAndCleanMnemonic } from '@/core/apis/mnemonic';
import { requestKeyring } from '@/core/apis/keyring';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
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
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';
import { useShowImportMoreAddressPopup } from '@/hooks/useShowImportMoreAddressPopup';
import * as SecretVault from '@/core/utils/secretVault';
import { E2E_ID } from '@/constant/e2e';
import { makeTestIDProps } from '@/utils/makeTestIDProps';

/** Toast position at the top of screen */
const TOAST_POSITION_TOP = 30;

type TabType = 'seedPhrase' | 'privateKey';

type ScreenProps = NativeStackScreenProps<RootStackParamsList, 'ImportSecret'>;

export const ImportSecret = ({ route }: ScreenProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const navigation = useNavigation<ScreenProps['navigation']>();
  const duplicateAddressModal = useDuplicateAddressModal();
  const { showImportMorePopup } = useShowImportMoreAddressPopup();

  const { initialTab, flow } = route.params ?? {};
  const isInAppFlow = flow === 'in_app';

  const [activeTab, setActiveTab] = React.useState<TabType>(
    initialTab ?? 'seedPhrase',
  );

  // Seed phrase state
  const [mnemonics, setMnemonics] = React.useState<string>('');
  const [mnemonicError, setMnemonicError] = React.useState<string>();

  // Private key state
  const [privateKey, setPrivateKey] = React.useState<string>('');
  const [privateKeyError, setPrivateKeyError] = React.useState<string>();

  const scanner = useScanner();

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
      } else {
        setPrivateKeyError(undefined);
        setPrivateKey(text);
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
        onPastedSensitiveData({
          type: 'seedPhrase',
          toastOptions: { position: TOAST_POSITION_TOP },
        });
      } else {
        setPrivateKeyError(undefined);
        setPrivateKey(text);
        onPastedSensitiveData({
          type: 'privateKey',
          toastOptions: { position: TOAST_POSITION_TOP },
        });
      }
    },
    [activeTab],
  );

  // Navigate to CreateNewWallet
  const handleCreateNewWallet = React.useCallback(() => {
    navigation.navigate(RootNames.SetupWallet);
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
          onPress={() => handleTabChange('privateKey')}
          {...makeTestIDProps(E2E_ID.onboarding.privateKeyTab)}>
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

  // Handle confirm button - navigate based on flow type
  const handleConfirm = React.useCallback(async () => {
    if (activeTab === 'seedPhrase') {
      // Clean and validate mnemonic
      let cleanedMnemonic: string;
      try {
        cleanedMnemonic = validateAndCleanMnemonic(mnemonics);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t('background.error.invalidMnemonic');
        setMnemonicError(message);
        return;
      }

      if (isInAppFlow) {
        // Import directly and navigate to success screen
        try {
          const { keyringId, isExistedKR } =
            await apiMnemonic.generateKeyringWithMnemonic(
              cleanedMnemonic,
              '',
              true,
            );
          const firstAddress = await requestKeyring(
            KEYRING_TYPE.HdKeyring,
            'getAddresses',
            keyringId ?? null,
            0,
            1,
          );
          try {
            const importedAccounts = await requestKeyring(
              KEYRING_TYPE.HdKeyring,
              'getAccounts',
              keyringId ?? null,
            );
            if (
              !importedAccounts ||
              (importedAccounts?.length < 1 && !!firstAddress?.length)
            ) {
              await new Promise(resolve => setTimeout(resolve, 1));
              await apiMnemonic.activeAndPersistAccountsByMnemonics(
                cleanedMnemonic,
                '',
                firstAddress as any,
                true,
              );
              return replaceToFirst(RootNames.StackAddress, {
                screen: RootNames.ImportSuccess2024,
                params: {
                  type: KEYRING_TYPE.HdKeyring,
                  brandName: KEYRING_CLASS.MNEMONIC,
                  isFirstImport: true,
                  address: [firstAddress?.[0].address],
                  mnemonics: cleanedMnemonic,
                  passphrase: '',
                  keyringId: keyringId || undefined,
                  isExistedKR,
                },
              });
            }
          } catch (error) {
            console.log('error', error);
          }
          // If account already exists, show import more popup
          showImportMorePopup({
            type: KEYRING_TYPE.HdKeyring,
            brandName: KEYRING_CLASS.MNEMONIC,
            mnemonics: cleanedMnemonic,
            passphrase: '',
            keyringId: keyringId || undefined,
          });
        } catch (error) {
          if ((error as any)?.name === 'DuplicateAccountError') {
            duplicateAddressModal.show({
              address: (error as any).message,
              brandName: KEYRING_CLASS.MNEMONIC,
              type: KEYRING_TYPE.HdKeyring,
            });
          } else {
            console.error(error);
          }
        }
      } else {
        // Onboarding flow: store in SecretVault and navigate to SetupWallet
        const vaultId = SecretVault.store(cleanedMnemonic);
        navigation.navigate(RootNames.SetupWallet, {
          seedPhraseVaultId: vaultId,
        });
      }
      preferenceService.setReportActionTs(
        REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_SEED_PHRASE,
      );
    } else {
      // Clean and validate private key
      let cleanedPrivateKey: string;
      try {
        cleanedPrivateKey = validateAndCleanPrivateKey(privateKey);
      } catch {
        setPrivateKeyError(t('background.error.invalidPrivateKey'));
        return;
      }

      if (isInAppFlow) {
        // Import directly and navigate to success screen
        try {
          const [account] = await apiPrivateKey.importPrivateKey(
            cleanedPrivateKey,
          );
          replaceToFirst(RootNames.StackAddress, {
            screen: RootNames.ImportSuccess2024,
            params: {
              type: KEYRING_TYPE.SimpleKeyring,
              brandName: KEYRING_CLASS.PRIVATE_KEY,
              address: account?.address,
            },
          });
        } catch (error) {
          if ((error as any)?.name === 'DuplicateAccountError') {
            duplicateAddressModal.show({
              address: (error as any).message,
              brandName: KEYRING_CLASS.PRIVATE_KEY,
              type: KEYRING_TYPE.SimpleKeyring,
            });
          } else {
            console.error(error);
          }
        }
      } else {
        // Onboarding flow: store in SecretVault and navigate to SetupWallet
        const vaultId = SecretVault.store(cleanedPrivateKey);
        navigation.navigate(RootNames.SetupWallet, {
          privateKeyVaultId: vaultId,
        });
      }
      preferenceService.setReportActionTs(
        REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_PRIVATE_KEY,
      );
    }
  }, [
    activeTab,
    mnemonics,
    privateKey,
    navigation,
    t,
    isInAppFlow,
    duplicateAddressModal,
    showImportMorePopup,
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

  const isConfirmDisabled = React.useMemo(() => {
    if (activeTab === 'seedPhrase') {
      return !mnemonics?.trim() || !!mnemonicError;
    }
    return !privateKey?.trim() || !!privateKeyError;
  }, [activeTab, mnemonics, mnemonicError, privateKey, privateKeyError]);

  const deferredHasInputContent = useDeferredValue(
    activeTab === 'seedPhrase' ? !!mnemonics?.trim() : !!privateKey?.trim(),
  );

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('global.Confirm'),
        onPress: handleConfirm,
        disabled: isConfirmDisabled,
        ...makeTestIDProps(
          activeTab === 'privateKey'
            ? E2E_ID.onboarding.privateKeySubmit
            : null,
        ),
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
                  ...makeTestIDProps(
                    activeTab === 'privateKey'
                      ? E2E_ID.onboarding.privateKeyInput
                      : null,
                  ),
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

          {/* Create New Wallet Link - hidden for in_app flow */}
          {!isInAppFlow && !deferredHasInputContent && (
            <View style={styles.linkWrapper}>
              <Text style={styles.linkText}>
                <Trans
                  i18nKey="page.newUserOnboarding.common.orYouCanCreateNewWallet"
                  t={t}
                  components={{
                    clickable: (
                      <Text
                        key="clickable"
                        style={styles.linkTextHighlight}
                        onPress={handleCreateNewWallet}
                        suppressHighlighting
                      />
                    ),
                  }}
                />
              </Text>
            </View>
          )}
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
