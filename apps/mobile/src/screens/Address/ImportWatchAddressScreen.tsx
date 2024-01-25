import { Text } from '@/components';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import React, { useEffect, useRef } from 'react';
import {
  NativeSyntheticEvent,
  StatusBar,
  StyleSheet,
  TextInput,
  TextInputSubmitEditingEventData,
  View,
} from 'react-native';
import WatchLogoSVG from '@/assets/icons/address/watch-logo.svg';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { navigate } from '@/utils/navigation';
import { isValidHexAddress } from '@metamask/utils';
import { apisAddress } from '@/core/apis';
import { AppColorsVariants } from '@/constant/theme';
import { openapi } from '@/core/request';
import { RcIconScannerCC } from '@/assets/icons/address';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { CameraPopup } from './components/CameraPopup';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Code } from 'react-native-vision-camera';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import TouchableView from '@/components/Touchable/TouchableView';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

enum INPUT_ERROR {
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  ADDRESS_EXIST = 'ADDRESS_EXIST',
  REQUIRED = 'REQUIRED',
}

const ERROR_MESSAGE = {
  [INPUT_ERROR.INVALID_ADDRESS]:
    "The address you're are trying to import is invalid",
  [INPUT_ERROR.ADDRESS_EXIST]:
    "The address you're are trying to import is duplicated",
  [INPUT_ERROR.REQUIRED]: 'Please input address',
};

export const ImportWatchAddressScreen = () => {
  const insets = useSafeAreaInsets();
  console.log('insets top', insets.top);
  const codeRef = useRef<BottomSheetModal>(null);
  const colors = useThemeColors();
  const [input, setInput] = React.useState('');
  const [error, setError] = React.useState<INPUT_ERROR>();
  const [ensResult, setEnsResult] = React.useState<null | {
    addr: string;
    name: string;
  }>(null);
  const styles = React.useMemo(
    () => getStyles(colors, insets),
    [colors, insets],
  );

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
      await apisAddress.addWatchAddress(input);
      navigate(RootNames.ImportSuccess, {
        address: input,
        brandName: KEYRING_CLASS.WATCH,
      });
    } catch (e) {
      setError(INPUT_ERROR.ADDRESS_EXIST);
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
      <KeyboardAwareScrollView style={styles.keyboardView}>
        <View style={styles.titleContainer}>
          <WatchLogoSVG style={styles.logo} />
          <Text style={styles.title}>Add Contacts</Text>
          <Text style={styles.description}>
            You can also use it as a watch-only address
          </Text>
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            numberOfLines={2}
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
            onSubmitEditing={onSubmitEditing}
            placeholder="Address / ENS"
            placeholderTextColor={colors['neutral-title-1']}
          />

          {!error && ensResult && input === ensResult.addr && (
            <Text style={styles.ensText}>ENS: {ensResult.name}</Text>
          )}

          {!error && ensResult && input !== ensResult.addr && (
            <View style={styles.ensResultBox}>
              <TouchableItem
                onPress={() => {
                  setInput(ensResult.addr);
                }}>
                <Text style={styles.ensResult}>{ensResult.addr}</Text>
              </TouchableItem>
            </View>
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
              color={colors['neutral-line']}
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
    </RootScreenContainer>
  );
};

const getStyles = function (colors: AppColorsVariants, inset: EdgeInsets) {
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
      height: 320 - inset.top - (StatusBar?.currentHeight || 0),
      flexShrink: 0,
      backgroundColor: colors['blue-default'],
      color: colors['neutral-title-2'],
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors['neutral-title-2'],
      marginTop: 25,
    },
    description: {
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-title-2'],
      marginTop: 8,
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
      height: '100%',
      backgroundColor: colors['neutral-bg-2'],
    },
    logo: {
      width: 240,
      height: 240,
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
      paddingHorizontal: 12,
      paddingVertical: 0,
      fontSize: 14,
      height: 64,
      color: colors['neutral-title-1'],
      borderWidth: 1,
      textAlignVertical: 'center',
      paddingEnd: 'auto',
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
      height: '100%',
      alignItems: 'center',
      fontSize: 13,
      borderRadius: 6,
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
