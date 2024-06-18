import { createGetStyles } from '@/utils/styles';
import React from 'react';
import { Dimensions, View } from 'react-native';
import { useThemeStyles } from '@/hooks/theme';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';
import { colord } from 'colord';
import { useNavigation } from '@react-navigation/native';
import { atom, useAtom } from 'jotai';
import { Code } from 'react-native-vision-camera';

const CAMERA_WIDTH = Dimensions.get('window').width - 70;

const textAtom = atom<string | undefined>(undefined);

export const useScanner = () => {
  const [text, setText] = useAtom(textAtom);

  const clear = () => setText(undefined);

  return { text, clear };
};

export const ScannerScreen = () => {
  const [_, setText] = useAtom(textAtom);
  const { styles } = useThemeStyles(getStyles);
  const nav = useNavigation();
  const handleCodeScanned = React.useCallback(
    (data: Code[]) => {
      setText(data[0].value!);
      nav.goBack();
    },
    [nav, setText],
  );

  return (
    <View style={styles.main}>
      <View style={styles.wrapper}>
        <QRCodeScanner
          containerStyle={styles.containerStyle}
          onCodeScanned={handleCodeScanned}
        />
      </View>
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  main: {
    flex: 1,
    backgroundColor: colors['neutral-black'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapper: {},
  containerStyle: {
    width: CAMERA_WIDTH,
    height: CAMERA_WIDTH,
    borderColor: colord(colors['neutral-line']).alpha(0.5).toHex(),
  },
}));
