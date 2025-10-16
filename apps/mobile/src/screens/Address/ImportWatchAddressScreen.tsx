import { RcIconScannerCC } from '@/assets/icons/address';
import WatchLogoSVG from '@/assets/icons/address/watch-logo.svg';
import { FocusAwareStatusBar, Text } from '@/components';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import TouchableView from '@/components/Touchable/TouchableView';
import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { apisAddress } from '@/core/apis';
import { openapi } from '@/core/request';
import { useThemeColors } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { navigateDeprecated } from '@/utils/navigation';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { isValidHexAddress } from '@metamask/utils';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React, { useEffect, useRef } from 'react';
import {
  Keyboard,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  TextInput,
  TextInputSubmitEditingEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Code } from 'react-native-vision-camera';
import { CameraPopup } from './components/CameraPopup';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';

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

export const ImportWatchAddressScreen = () => {
  const { safeOffHeader } = useSafeSizes();

  const codeRef = useRef<BottomSheetModal>(null);
  const colors = useThemeColors();
  const [input, setInput] = React.useState('');
  const [error, setError] = React.useState<INPUT_ERROR>();
  const [ensResult, setEnsResult] = React.useState<null | {
    addr: string;
    name: string;
  }>(null);
  const styles = React.useMemo(
    () => getStyles(colors, safeOffHeader),
    [colors, safeOffHeader],
  );
  const duplicateAddressModal = useDuplicateAddressModal();

  const handleDone = async () => {
    if (!input) {
      setError(INPUT_ERROR.REQUIRED);
      return;
    }
    if (!isValidHexAddress(input as any)) {
      setError(INPUT_ERROR.INVALID_ADDRESS);
      return;
    }
    try {
      Keyboard.dismiss();
      await apisAddress.addWatchAddress(input);
      navigateDeprecated(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess,
        params: {
          type: KEYRING_TYPE.WatchAddressKeyring,
          address: input,
          brandName: KEYRING_CLASS.WATCH,
        },
      });
    } catch (err: any) {
      if (err.name === 'DuplicateAccountError') {
        duplicateAddressModal.show({
          address: err.message,
          brandName: KEYRING_CLASS.WATCH,
          type: KEYRING_TYPE.WatchAddressKeyring,
        });
      } else {
        setError(err.message);
      }
    }
  };

  const handleSubmit = React.useCallback(
    (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      setInput(e.nativeEvent.text);
    },
    [],
  );

  const openCamera = React.useCallback(() => {
    codeRef.current?.present();
  }, []);

  const onSubmitEditing = React.useCallback(() => {
    if (!error && ensResult && input !== ensResult.addr) {
      setInput(ensResult.addr);
    }
  }, [error, ensResult, input]);

  const onCodeScanned = (codes: Code[]) => {
    if (codes[0].value && isValidHexAddress(codes[0].value as `0x${string}`)) {
      codeRef.current?.close();
      setInput(codes[0].value);
    }
  };

  useEffect(() => {
    if (!input) {
      setError(undefined);
      return;
    }
    if (isValidHexAddress(input as `0x${string}`)) {
      setError(undefined);
      return;
    }
    openapi
      .getEnsAddressByName(input)
      .then(result => {
        if (result && result.addr) {
          setEnsResult(result);
          setError(undefined);
        } else {
          setEnsResult(null);
          setError(INPUT_ERROR.INVALID_ADDRESS);
        }
      })
      .catch(e => {
        console.log(e);
        setEnsResult(null);
        setError(INPUT_ERROR.INVALID_ADDRESS);
      });
  }, [input]);

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
          <WatchLogoSVG />
          <Text style={styles.title}>Add Contacts</Text>
          <Text style={styles.description}>
            You can also use it as watch-only wallet
          </Text>
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            multiline
            value={input}
            onChange={handleSubmit}
            style={[
              styles.input,
              {
                borderColor: error
                  ? colors['red-default']
                  : colors['neutral-line'],
              },
            ]}
            blurOnSubmit
            onSubmitEditing={onSubmitEditing}
            // autoFocus
            placeholder="Address / ENS"
            placeholderTextColor={colors['neutral-foot']}
          />

          {!error && ensResult && input === ensResult.addr && (
            <Text style={styles.ensText}>ENS: {ensResult.name}</Text>
          )}

          {!error && ensResult && input !== ensResult.addr && (
            <TouchableOpacity
              style={styles.ensResultBox}
              onPress={() => {
                Keyboard.dismiss();
                setInput(ensResult.addr);
              }}>
              <Text style={styles.ensResult}>{ensResult.addr}</Text>
            </TouchableOpacity>
          )}

          {error && (
            <Text style={styles.errorMessage}>{ERROR_MESSAGE[error]}</Text>
          )}
          <TouchableView
            onPress={openCamera}
            style={[
              styles.scanButtonContainer,
              !error && ensResult && input === ensResult.addr && styles.ensMt,
            ]}>
            <RcIconScannerCC
              color={colors['neutral-foot']}
              style={styles.scanIcon}
            />
            <Text style={styles.scanButtonTitle}>Scan via camera</Text>
          </TouchableView>
        </View>
      </KeyboardAwareScrollView>
      <FooterButton
        disabled={!input || !!error}
        title="Confirm"
        onPress={handleDone}
      />
      <CameraPopup ref={codeRef} onCodeScanned={onCodeScanned} />
      <ScreenSpecificStatusBar screenName={RootNames.ImportWatchAddress} />
    </RootScreenContainer>
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
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors['neutral-title-2'],
      marginTop: 24,
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

    ensResultBox: {
      padding: 4,
      borderRadius: 6,
      backgroundColor: colors['neutral-bg-1'],
      position: 'absolute',
      top: 24 + 64 + 6,
      left: 20,
      width: '100%',
      zIndex: 2,
    },

    ensResult: {
      padding: 12,
      backgroundColor: colors['blue-light-1'],
      color: colors['neutral-title-1'],
      height: '100%',
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: 13,
      borderRadius: 4,
      overflow: 'hidden',
    },
    ensText: {
      fontSize: 13,
      color: colors['neutral-body'],
      marginVertical: 12,
    },
    scanButtonContainer: {
      width: 148,
      height: 36,
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 6,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      paddingLeft: 12,
      marginTop: 16,
    },
    ensMt: {
      marginTop: 0,
    },
    scanButtonTitle: {
      color: colors['neutral-title-1'],
      fontSize: 12,
    },
    scanIcon: {
      width: 14,
      height: 14,
    },
  });
};
