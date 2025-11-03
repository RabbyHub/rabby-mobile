import RcSafeLogo from '@/assets/icons/address/icon-safe.svg';
import { FocusAwareStatusBar, Text } from '@/components';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { apisAddress } from '@/core/apis';
import { apisSafe } from '@/core/apis/safe';
import { useThemeColors } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { navigateDeprecated } from '@/utils/navigation';
import { isValidAddress } from '@ethereumjs/util';
import { isValidHexAddress } from '@metamask/utils';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useMemoizedFn, useRequest } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Keyboard,
  NativeSyntheticEvent,
  Platform,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputSubmitEditingEventData,
  View,
  ViewProps,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Spin } from '../TransactionRecord/components/Spin';
import { Chain } from '@/constant/chains';
import { ViewStyle } from 'react-native-size-matters';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';

enum INPUT_ERROR {
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  ADDRESS_EXIST = 'ADDRESS_EXIST',
  REQUIRED = 'REQUIRED',
}

const ERROR_MESSAGE = {
  [INPUT_ERROR.INVALID_ADDRESS]:
    "The address you're trying to import is invalid",
  [INPUT_ERROR.ADDRESS_EXIST]:
    "The address you're trying to import is duplicated",
  [INPUT_ERROR.REQUIRED]: 'Please input address',
};

export const ImportSafeAddressScreen = () => {
  const { safeOffHeader } = useSafeSizes();

  const colors = useThemeColors();
  const [input, setInput] = React.useState('');
  const [error, setError] = React.useState<string>();

  const styles = React.useMemo(
    () => getStyles(colors, safeOffHeader),
    [colors, safeOffHeader],
  );

  const { t } = useTranslation();

  const {
    data: chainList,
    runAsync,
    loading,
  } = useRequest(
    async (address: string) => {
      const res = await apisSafe.fetchGnosisChainList(address);
      if (!res.length) {
        throw new Error('This address is not a valid safe address');
      }
      return res;
    },
    {
      manual: true,
      debounceWait: 500,
      onBefore() {
        setError('');
      },
      onError(e) {
        setError(e.message);
      },
      onSuccess() {
        setError('');
      },
    },
  );

  const handleChange = useMemoizedFn(
    (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      const value = e.nativeEvent.text;
      setInput(value);
      if (!value) {
        setError(t('page.importSafe.error.required'));
        return;
      }
      if (!isValidAddress(value)) {
        setError(t('page.importSafe.error.invalid'));
        return;
      }
      runAsync(value);
    },
  );
  const duplicateAddressModal = useDuplicateAddressModal();

  const handleNext = async () => {
    Keyboard.dismiss();
    try {
      await apisSafe.importGnosisAddress(
        input,
        (chainList || []).map(chain => chain.network),
      );
      navigateDeprecated(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess,
        params: {
          type: KEYRING_TYPE.GnosisKeyring,
          address: input,
          brandName: KEYRING_CLASS.GNOSIS,
          supportChainList: chainList,
        },
      });
    } catch (err: any) {
      if (err.name === 'DuplicateAccountError') {
        duplicateAddressModal.show({
          address: err.message,
          brandName: KEYRING_CLASS.GNOSIS,
          type: KEYRING_TYPE.GnosisKeyring,
        });
      } else {
        setError(err?.message || t('Not a valid address'));
      }
    }
  };

  return (
    <RootScreenContainer hideBottomBar style={styles.rootContainer}>
      <KeyboardAwareScrollView
        style={styles.keyboardView}
        enableOnAndroid
        extraHeight={150}
        scrollEnabled={false}
        keyboardOpeningTime={0}
        keyboardShouldPersistTaps="handled">
        <View style={styles.titleContainer}>
          <RcSafeLogo width={80} height={80} style={styles.logo} />
          <Text style={styles.title}>{t('page.importSafe.title')}</Text>
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            multiline
            value={input}
            onChange={handleChange}
            style={[
              styles.input,
              {
                borderColor: error
                  ? colors['red-default']
                  : colors['neutral-line'],
              },
            ]}
            blurOnSubmit
            // autoFocus
            placeholder="Input safe address"
            placeholderTextColor={colors['neutral-foot']}
          />
          {loading ? (
            <View style={styles.loading}>
              <Spin style={styles.spin} color={colors['neutral-body']} />
              <Text style={styles.loadingText}>
                {t('page.importSafe.loading')}
              </Text>
            </View>
          ) : (
            <>
              {error ? (
                <Text style={styles.errorMessage}>{error}</Text>
              ) : (
                !!chainList?.length && (
                  <GnosisSupportChainList data={chainList} />
                )
              )}
            </>
          )}
        </View>
      </KeyboardAwareScrollView>
      <FooterButton
        disabled={!input || !!error || loading}
        title="Next"
        onPress={handleNext}
      />
      <FocusAwareStatusBar backgroundColor={colors['blue-default']} />
    </RootScreenContainer>
  );
};

export const GnosisSupportChainList = ({
  data,
  style,
}: {
  data: Chain[];
  style?: ViewProps['style'];
}) => {
  const { safeOffHeader } = useSafeSizes();

  const colors = useThemeColors();

  const { t } = useTranslation();
  const styles = React.useMemo(
    () => getStyles(colors, safeOffHeader),
    [colors, safeOffHeader],
  );

  return (
    <View style={[styles.chainListContainer, style]}>
      <Text style={styles.chainListDesc}>
        {t('page.importSafe.gnosisChainDesc', {
          count: data?.length,
        })}
      </Text>
      <View style={styles.chainList}>
        {data?.map(chain => {
          return (
            <View style={styles.chainListItem} key={chain.id}>
              <Image
                source={{
                  uri: chain.logo,
                }}
                alt=""
                style={styles.chainLogo}
              />
              <Text style={styles.chainName}>{chain.name}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const getStyles = function (colors: AppColorsVariants, topInset: number) {
  return StyleSheet.create({
    rootContainer: {
      display: 'flex',
      backgroundColor: colors['blue-default'],
      height: '100%',
    },
    scrollView: {
      backgroundColor: colors['neutral-bg-2'],
    },
    titleContainer: {
      width: '100%',
      height: 320 - topInset,
      flexShrink: 0,
      backgroundColor: colors['blue-default'],
      color: colors['neutral-title-2'],
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: 60,
    },
    logo: {
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors['neutral-title-2'],
      marginTop: 4,
    },
    description: {
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-title-2'],
      marginTop: 8,
      marginBottom: 36,
    },
    inputContainer: {
      backgroundColor: colors['neutral-bg-2'],
      paddingVertical: 24,
      paddingHorizontal: 20,
      flex: 1,
      position: 'relative',
      // minHeight: 80,
    },
    keyboardView: {
      flex: 1,
      height: '100%',
      backgroundColor: colors['neutral-bg-2'],
    },
    errorMessage: {
      color: colors['red-default'],
      fontSize: 13,
      marginTop: 12,
      marginBottom: 16,
    },
    input: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 0,
      fontSize: 15,
      color: colors['neutral-title-1'],
      borderWidth: 1,
      textAlignVertical: 'center',
      paddingTop: 16,
      paddingBottom: 16,
    },
    loading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
    },
    spin: {
      width: 16,
      height: 16,
    },
    loadingText: {
      color: colors['neutral-body'],
      fontSize: 13,
    },
    chainListContainer: {
      marginTop: 12,
    },
    chainListDesc: {
      color: colors['neutral-body'],
      fontSize: 13,
      marginBottom: 12,
    },
    chainList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    chainListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    chainLogo: {
      width: 20,
      height: 20,
    },
    chainName: {
      color: colors['neutral-title-1'],
      fontSize: 13,
      fontWeight: '500',
    },
  });
};
