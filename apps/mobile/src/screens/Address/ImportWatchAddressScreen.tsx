import { Button, Text } from '@/components';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import {
  NativeSyntheticEvent,
  ScrollView,
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
  const colors = useThemeColors();
  const [input, setInput] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [error, setError] = React.useState<INPUT_ERROR>();
  const [hasBlur, setHasBlur] = React.useState(false);
  const [ensResult, setEnsResult] = React.useState<null | {
    addr: string;
    name: string;
  }>(null);
  const styles = getStyles(colors);

  const handleDone = async () => {
    try {
      await apisAddress.addWatchAddress(address);
      navigate(RootNames.ImportSuccess, {
        address,
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

  React.useEffect(() => {
    if (!hasBlur) {
      return;
    }
    if (!input) {
      setError(INPUT_ERROR.REQUIRED);
      return;
    }
    if (isValidHexAddress(input as any)) {
      setAddress(input);
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
          setError(INPUT_ERROR.INVALID_ADDRESS);
        }
      })
      .catch(e => {
        console.log(e);
        setEnsResult(null);
        setError(INPUT_ERROR.INVALID_ADDRESS);
      });
  }, [input, hasBlur]);

  return (
    <RootScreenContainer style={styles.rootContainer}>
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
            onBlur={() => {
              setHasBlur(true);
            }}
            onChange={e => {
              handleSubmit(e);
              setError(undefined);
            }}
            style={[
              styles.input,
              {
                borderColor: error
                  ? colors['red-default']
                  : colors['neutral-line'],
              },
            ]}
            placeholder="Address / ENS"
            placeholderTextColor={colors['neutral-title-1']}
          />

          {error && (
            <Text style={styles.errorMessage}>{ERROR_MESSAGE[error]}</Text>
          )}
          {/* <Button title="Scan via camera" icon={<RcIconScannerCC />} /> */}
        </View>
      </KeyboardAwareScrollView>
      <FooterButton disabled={!address} title="Confirm" onPress={handleDone} />
    </RootScreenContainer>
  );
};

const getStyles = function (colors: AppColorsVariants) {
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
      height: 320,
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
    },
    input: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      paddingHorizontal: 12,
      fontSize: 14,
      height: 52,
      color: colors['neutral-title-1'],
      borderWidth: 1,
    },
  });
};
