import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';
import { colord } from 'colord';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { atom, useAtom } from 'jotai';
import { Code } from 'react-native-vision-camera';
import { RootStackParamsList } from '@/navigation-type';
import { RootNames } from '@/constant/layout';
import { URDecoder } from '@ngraveio/bc-ur';

const CAMERA_WIDTH = Dimensions.get('window').width - 70;

const textAtom = atom<string | undefined>(undefined);

export const useScanner = () => {
  const [text, setText] = useAtom(textAtom);

  const clear = () => setText(undefined);

  return { text, clear };
};

export const ScannerScreen = () => {
  const [_, setText] = useAtom(textAtom);
  const { styles } = useTheme2024({ getStyle: getStyles });
  const navState = useNavigationState(
    s => s.routes.find(e => e.name === RootNames.Scanner)?.params,
  ) as RootStackParamsList['Scanner'] | undefined;
  const nav = useNavigation();
  const [decoder] = useState(new URDecoder());
  const [currentCount, setCurrentCount] = useState(0);

  const handleCodeScanned = React.useCallback(
    (data: Code[]) => {
      if (navState?.syncExtension) {
        const value = data[0]?.value;
        if (value && value.startsWith('ur:')) {
          try {
            decoder.receivePart(value);
            setCurrentCount(decoder.getProgress());
            if (decoder.isComplete()) {
              const ur = decoder.resultUR();
              const a = ur.decodeCBOR();
              setText(a.toString());
              nav.goBack();
            }
          } catch (error) {
            console.error('handleCodeScanned error', error);
          }
        }
      } else {
        setText(data[0].value!);
        nav.goBack();
      }
    },
    [decoder, nav, navState?.syncExtension, setText],
  );

  return (
    <View style={styles.main}>
      <View style={styles.wrapper}>
        <QRCodeScanner
          containerStyle={styles.containerStyle}
          onCodeScanned={handleCodeScanned}
        />
        <Text style={styles.tips}>Click “Rabby Mobile” on Rabby Extension</Text>
        <Text style={styles.tips}>Scan the QR code to sync</Text>
        {currentCount ? (
          <Text style={styles.progress}>
            {(currentCount * 100).toFixed(2)}%
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  main: {
    flex: 1,
    backgroundColor: ctx.colors2024['neutral-black'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapper: {},
  containerStyle: {
    width: CAMERA_WIDTH,
    height: CAMERA_WIDTH,
    borderColor: colord(ctx.colors2024['neutral-line']).alpha(0.5).toHex(),
    marginBottom: 40,
  },
  tips: {
    color: '#F7FAFC',
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 5,
  },
  progress: {
    color: '#F7FAFC',
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
  },
}));
