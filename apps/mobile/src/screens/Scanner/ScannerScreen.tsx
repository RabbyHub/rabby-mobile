import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';
import { colord } from 'colord';
import {
  StackActions,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native';
import { atom, useAtom } from 'jotai';
import { Code } from 'react-native-vision-camera';
import { RootStackParamsList } from '@/navigation-type';
import { RootNames } from '@/constant/layout';
import { URDecoder } from '@ngraveio/bc-ur';
import { strFromU8, gunzipSync } from 'fflate';
import { useTranslation } from 'react-i18next';

const CAMERA_WIDTH = Dimensions.get('window').width - 70;

const textAtom = atom<string | undefined>(undefined);

export const useScanner = () => {
  const [text, setText] = useAtom(textAtom);

  const clear = () => setText(undefined);

  return { text, clear };
};

export const ScannerScreen = () => {
  const { t } = useTranslation();
  const [_, setText] = useAtom(textAtom);
  const { styles } = useTheme2024({ getStyle: getStyles });
  const navState = useNavigationState(
    s => s.routes.find(e => e.name === RootNames.Scanner)?.params,
  ) as RootStackParamsList['Scanner'] | undefined;
  const nav = useNavigation();
  const [decoder] = useState(new URDecoder());
  const [currentCount, setCurrentCount] = useState(0);

  const isSyncExtensionScanned = useRef(false);

  const handleCodeScanned = React.useCallback(
    (data: Code[]) => {
      if (navState?.syncExtension) {
        const value = data[0]?.value;
        if (value && value.startsWith('ur:')) {
          try {
            decoder.receivePart(value);
            setCurrentCount(decoder.estimatedPercentComplete());

            if (decoder.isComplete()) {
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
                    percent: (currentCount * 100).toFixed(2) + '%',
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
