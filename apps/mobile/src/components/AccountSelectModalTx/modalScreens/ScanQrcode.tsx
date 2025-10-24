import { createGetStyles2024, makeDevOnlyStyle } from '@/utils/styles';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';
import { colord } from 'colord';
import { Code } from 'react-native-vision-camera';
import {
  modalScannerEvents,
  ModalScannerEventType,
  useAccountSelectModalCtx,
} from '../hooks';

const CAMERA_WIDTH = Dimensions.get('window').width - 70;

export const ScreenPanelScanner = () => {
  const { nextScanFor, fnNavTo } = useAccountSelectModalCtx();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const handleCodeScanned = React.useCallback(
    (data: Code[]) => {
      fnNavTo(nextScanFor || 'default', {
        inputValue: data[0]?.value,
      });
    },
    [fnNavTo, nextScanFor],
  );

  return (
    <View style={styles.main}>
      <View style={styles.wrapper}>
        <QRCodeScanner
          containerStyle={styles.containerStyle}
          onCodeScanned={handleCodeScanned}
          size={CAMERA_WIDTH}
        />
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  main: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    // backgroundColor: ctx.colors2024['black'],
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    // ...makeDevOnlyStyle({
    //   backgroundColor: 'white',
    // })
  },
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  containerStyle: {
    width: CAMERA_WIDTH,
    height: CAMERA_WIDTH,
    borderColor: colord(ctx.colors2024['neutral-line']).alpha(0.5).toHex(),
  },
}));
