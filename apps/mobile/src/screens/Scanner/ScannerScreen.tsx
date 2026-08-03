import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { QRCodeScanner } from '@/components/QRCodeScanner/QRCodeScanner';
import { colord } from 'colord';
import {
  StackActions,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { GetRootScreenRouteProp } from '@/navigation-type';
import { Code } from 'react-native-vision-camera';
import { RootNames } from '@/constant/layout';
import { URDecoder } from '@ngraveio/bc-ur';
import { useTranslation } from 'react-i18next';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import EventEmitter from 'events';
import { throttle } from 'lodash';
import { Text } from '@/components/Typography';
import RNFS from '@rabby-wallet/react-native-fs';
import RNFileHelpers from '@/core/native/RNFileHelpers';
import { toast } from '@/components2024/Toast';
import {
  MAX_SYNC_VIDEO_DURATION_SECONDS,
  receiveSyncURPart,
} from '@/utils/syncExtensionTransfer';
import {
  decodeSyncTransferVideoParts,
  validateSyncTransferVideoAsset,
} from '@/utils/syncExtensionTransferVideoImport';
import { useScanner } from './scannerState';

const CAMERA_WIDTH = Dimensions.get('window').width - 70;

export { useScanner } from './scannerState';

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
  const { setText } = useScanner();
  const { styles } = useTheme2024({ getStyle: getStyles });
  const route = useRoute<GetRootScreenRouteProp<'Scanner'>>();
  const navigation = useRabbyAppNavigation();
  const navState = route.params;
  const nav = useNavigation();
  const [currentCount, setCurrentCount] = useState(0);
  const [processingVideo, setProcessingVideo] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(
    () => !navState?.syncExtension,
  );

  const isSyncExtensionScanned = useRef(false);
  const isMounted = useRef(true);
  const selectingVideo = useRef(false);
  const decoder = useRef(new URDecoder());
  const count = useRef(0);
  const videoJobId = useRef<string | undefined>(undefined);

  const finishSyncExtension = React.useCallback(
    (result: string) => {
      if (!isMounted.current || isSyncExtensionScanned.current) {
        return;
      }
      count.current = 0;
      isSyncExtensionScanned.current = true;
      setText(result);
      nav.dispatch(
        StackActions.replace(RootNames.StackAddress, {
          screen: RootNames.SyncExtensionPassword,
        }),
      );
    },
    [nav, setText],
  );

  const handleCodeScanned = React.useCallback(
    (data: Code[]) => {
      scannerEvents.emit(ScannerEventType.scanned);
      if (navState?.syncExtension) {
        if (
          processingVideo ||
          selectingVideo.current ||
          isSyncExtensionScanned.current
        ) {
          return;
        }
        const value = data[0]?.value;
        if (value) {
          try {
            const received = receiveSyncURPart(decoder.current, value);
            if (!received.accepted) {
              return;
            }
            if (count.current % 3 === 0) {
              setCurrentCount(received.progress);
            }
            count.current++;
            if (received.result) {
              finishSyncExtension(received.result);
            }
          } catch (error) {
            console.error('handleCodeScanned error', error);
            decoder.current = new URDecoder();
            count.current = 0;
            setCurrentCount(0);
          }
        }
      } else {
        const value = data[0]?.value;
        if (value) {
          setText(value);
          nav.goBack();
        }
      }
    },
    [
      finishSyncExtension,
      nav,
      navState?.syncExtension,
      processingVideo,
      setText,
    ],
  );

  const handleSelectVideo = React.useCallback(async () => {
    if (
      processingVideo ||
      selectingVideo.current ||
      isSyncExtensionScanned.current
    ) {
      return;
    }

    let activeJobId = '';
    let cleanupPath = '';
    selectingVideo.current = true;
    setProcessingVideo(true);
    try {
      const pickedVideo = await RNFileHelpers.pickVideoFile();
      if (!pickedVideo) {
        return;
      }
      cleanupPath = pickedVideo.cleanupPath;
      if (!isMounted.current) {
        return;
      }

      const validation = validateSyncTransferVideoAsset(pickedVideo);
      if ('error' in validation) {
        toast.error(t('page.syncExtensionTransfer.invalidVideo'));
        return;
      }

      decoder.current = new URDecoder();
      count.current = 0;
      setCurrentCount(0);
      activeJobId = `sync-import-${Date.now()}`;
      videoJobId.current = activeJobId;
      const parts = await RNFileHelpers.decodeQRCodesFromVideo({
        uri: validation.uri,
        sampleIntervalMs: 100,
        maxDurationSeconds: MAX_SYNC_VIDEO_DURATION_SECONDS,
        maxDimension: 1280,
        jobId: activeJobId,
      });
      const result = decodeSyncTransferVideoParts(parts);
      finishSyncExtension(result);
    } catch (error) {
      console.error('[Scanner] decode transfer video failed', error);
      if (isMounted.current) {
        toast.error(
          t(
            error instanceof Error && error.message.includes('Incomplete')
              ? 'page.syncExtensionTransfer.incompleteVideo'
              : 'page.syncExtensionTransfer.videoImportFailed',
          ),
        );
      }
    } finally {
      selectingVideo.current = false;
      if (videoJobId.current === activeJobId) {
        videoJobId.current = undefined;
      }
      if (cleanupPath) {
        try {
          if (await RNFS.exists(cleanupPath)) {
            await RNFS.unlink(cleanupPath);
          }
        } catch (error) {
          console.warn('[Scanner] cleanup transfer video failed', error);
        }
      }
      if (isMounted.current && !isSyncExtensionScanned.current) {
        setProcessingVideo(false);
      }
    }
  }, [finishSyncExtension, processingVideo, t]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (navState?.syncExtension) {
        RNFileHelpers.cancelVideoFilePicker();
        if (videoJobId.current) {
          RNFileHelpers.cancelQRCodeVideoJob(videoJobId.current);
          videoJobId.current = undefined;
        }
        if (!isSyncExtensionScanned.current) {
          setText(undefined);
        }
      }
    };
  }, [navState?.syncExtension, setText]);

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
        {processingVideo ? (
          <View style={[styles.containerStyle, styles.processingContainer]}>
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
        ) : navState?.syncExtension && !scanEnabled ? (
          <View style={[styles.containerStyle, styles.importChoices]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setScanEnabled(true)}
              style={styles.choiceButton}>
              <Text style={styles.videoButtonText}>
                {t('page.syncExtension.scanTips2')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleSelectVideo}
              style={styles.choiceButton}>
              <Text style={styles.videoButtonText}>
                {t('page.syncExtensionTransfer.selectVideo')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <QRCodeScanner
            containerStyle={styles.containerStyle}
            onCodeScanned={handleCodeScanned}
            size={CAMERA_WIDTH}
            showScanLine={navState?.syncExtension && currentCount > 0}
          />
        )}
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
            {scanEnabled || processingVideo ? (
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={processingVideo}
                onPress={handleSelectVideo}
                style={styles.videoButton}>
                {processingVideo ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : null}
                <Text style={styles.videoButtonText}>
                  {t(
                    processingVideo
                      ? 'page.syncExtensionTransfer.processingVideo'
                      : 'page.syncExtensionTransfer.selectVideo',
                  )}
                </Text>
              </TouchableOpacity>
            ) : null}
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
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  importChoices: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  choiceButton: {
    width: '84%',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: ctx.colors2024['blue-default'],
    alignItems: 'center',
    justifyContent: 'center',
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
  videoButton: {
    alignSelf: 'center',
    minWidth: 180,
    height: 48,
    marginTop: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: ctx.colors2024['blue-default'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
}));
