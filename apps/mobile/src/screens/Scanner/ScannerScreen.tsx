import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';
import { colord } from 'colord';
import {
  StackActions,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { GetRootScreenRouteProp } from '@/navigation-type';
import { atom, useAtom } from 'jotai';
import { Code } from 'react-native-vision-camera';
import { RootStackParamsList } from '@/navigation-type';
import { RootNames } from '@/constant/layout';
import { URDecoder } from '@ngraveio/bc-ur';
import { strFromU8, gunzipSync } from 'fflate';
import { useTranslation } from 'react-i18next';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import EventEmitter from 'events';
import { throttle } from 'lodash';

const CAMERA_WIDTH = Dimensions.get('window').width - 70;

const textAtom = atom<string | undefined>(undefined);

export const useScanner = () => {
  const [text, setText] = useAtom(textAtom);

  const clear = () => setText(undefined);

  return { text, clear };
};

const scannerEvents = new EventEmitter();

export const enum ScannerEventType {
  scanned = 'scanned',
  navBack = 'navBack',
}
export const onScannerEvent = (
  type: ScannerEventType,
  callback: (data: string) => void,
) => {
  scannerEvents.addListener(type, callback);

  return () => {
    scannerEvents.removeListener(type, callback);
  };
};

export const ScannerScreen = () => {
  const { t } = useTranslation();
  const [_, setText] = useAtom(textAtom);
  const { styles } = useTheme2024({ getStyle: getStyles });
  const route = useRoute<GetRootScreenRouteProp<'Scanner'>>();
  const navigation = useRabbyAppNavigation();
  const navState = route.params;
  const nav = useNavigation();
  const [decoder] = useState(new URDecoder());
  const [currentCount, setCurrentCount] = useState(0);

  const isSyncExtensionScanned = useRef(false);

  const count = useRef(0);

  const handleCodeScanned = React.useCallback(
    (data: Code[]) => {
      scannerEvents.emit(ScannerEventType.scanned);
      if (navState?.syncExtension) {
        const value = data[0]?.value;
        if (value && value.startsWith('ur:')) {
          try {
            decoder.receivePart(value);
            if (count.current % 3 === 0) {
              setCurrentCount(decoder.getProgress());
            }
            count.current++;

            if (decoder.isComplete()) {
              count.current = 0;
              isSyncExtensionScanned.current = true;
              const ur = decoder.resultUR();
              const result = strFromU8(gunzipSync(Uint8Array.from(ur.cbor)));
              setText(result);

              nav.dispatch(
                StackActions.replace(RootNames.StackAddress, {
                  screen: RootNames.SyncExtensionPassword,
                }),
              );
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

  useEffect(() => {
    if (navState?.syncExtension) {
      return () => {
        if (!isSyncExtensionScanned) {
          setText(undefined);
        }
      };
    }
  }, [navState, setText]);

  useLayoutEffect(() => {
    const unsub = navigation.addListener(
      'beforeRemove',
      throttle(() => {
        scannerEvents.emit(ScannerEventType.navBack);
      }, 300),
    );

    return () => {
      unsub();
    };
  }, [navigation]);

  return (
    <View style={styles.main}>
      <View style={styles.wrapper}>
        <QRCodeScanner
          containerStyle={styles.containerStyle}
          onCodeScanned={handleCodeScanned}
          size={CAMERA_WIDTH}
          showScanLine={navState?.syncExtension && currentCount > 0}
        />
        {navState?.syncExtension ? (
          <>
            <Text style={currentCount > 0 ? styles.progress : styles.tips}>
              {currentCount > 0
                ? t('page.syncExtension.syncingProgress', {
                    percent: (currentCount * 100).toFixed(0) + '%',
                  })
                : t('page.syncExtension.scanTips1')}
            </Text>
            <Text style={styles.tips}>
              {currentCount > 0
                ? t('page.syncExtension.syncingTips')
                : t('page.syncExtension.scanTips2')}
            </Text>
          </>
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

  progress: {
    color: '#F7FAFC',
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 22,
    marginBottom: 18,
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
}));
