import { useMemo, useCallback, useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
// import ApkInstaller from '@isudaji/react-native-install-apk';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { openExternalUrl, openInAppBrowser } from '@/core/utils/linking';
import { APP_URLS } from '@/constant';
import {
  DownloadStage,
  useUpgradeInfo,
  useDownloadLatestApk,
} from '@/hooks/version';
import { makeDebugBorder } from '@/utils/styles';

import { Button } from '../Button';
import { toast } from '../Toast';

const isAndroid = Platform.OS === 'android';

const UPDATE_IN_APP_ON_ANDROID = false;

type FooterComponentProps = RNViewProps;

export default function FooterComponentForUpgrade(props: FooterComponentProps) {
  const { style } = props;

  const { styles } = useThemeStyles(getStyles);

  const {
    downloadStage,
    progressPercentText,
    progressInfo: { downloadResult },
    startDownload,
    resetProgress,
  } = useDownloadLatestApk();

  const { remoteVersion } = useUpgradeInfo();

  const onStartDownload = useCallback(async () => {
    if (!isAndroid) {
      openExternalUrl(remoteVersion?.downloadUrl || APP_URLS.STORE_URL);
      return;
    }

    if (UPDATE_IN_APP_ON_ANDROID) {
      return startDownload();
    }

    try {
      if (remoteVersion?.externalUrlToOpen) {
        openExternalUrl(remoteVersion.externalUrlToOpen);
      } else {
        await openInAppBrowser(APP_URLS.DOWNLOAD_PAGE);
      }
    } catch (error) {
      openExternalUrl(APP_URLS.DOWNLOAD_PAGE);
      toast.info('failed to open link');
    }
  }, [startDownload, remoteVersion]);

  const startDownloadButton = useMemo(() => {
    return (
      <Button
        onPress={onStartDownload}
        title={'Update'}
        type="primary"
        buttonStyle={[styles.buttonStyle]}
        titleStyle={[styles.btnActionTitle]}
        containerStyle={[styles.btnContainer]}
      />
    );
  }, [styles, onStartDownload]);

  const downloadingButton = useMemo(() => {
    const isConnecting = downloadStage === DownloadStage.connecting;

    return (
      <Button
        onPress={() => {}}
        disabled
        loading
        showTitleOnLoading
        title={
          isConnecting ? 'Connecting' : `Downloading ${progressPercentText}`
        }
        type="primary"
        loadingStyle={{ marginRight: 6 }}
        buttonStyle={[styles.buttonStyle]}
        titleStyle={[styles.btnActionTitle]}
        containerStyle={[styles.btnContainer]}
      />
    );
  }, [styles, progressPercentText, downloadStage]);

  const downloadedButton = useMemo(() => {
    return (
      <Button
        onPress={() => {
          if (downloadResult?.statusCode === 200) {
            // ApkInstaller.install(downloadedApkPath);
            // openExternalUrl(result.targetFilepath);
          }
          setTimeout(() => resetProgress(), 200);
        }}
        title="Install and Restart"
        type="success"
        loadingStyle={{ marginRight: 6 }}
        buttonStyle={[styles.buttonStyle]}
        titleStyle={[styles.btnActionTitle]}
        containerStyle={[styles.btnContainer]}
      />
    );
  }, [styles, resetProgress, downloadResult]);

  return (
    <View style={[styles.footerWrapper, style]}>
      <View style={[styles.btnGroup]}>
        {isAndroid ? (
          <>
            {downloadStage === DownloadStage.none && (
              <>
                {startDownloadButton}
                {/* <Button
                  onPress={() => {
                    openExternalUrl(APP_URLS.DOWNLOAD_PAGE);
                  }}
                  title="Homesite"
                  type="primary"
                  ghost
                  buttonStyle={[styles.buttonStyle]}
                  titleStyle={[styles.btnActionTitle, styles.btnGhostColor]}
                  containerStyle={[
                    styles.btnContainer,
                    styles.btnGhostContainer,
                    { marginLeft: 6 },
                  ]}
                /> */}
              </>
            )}
            {[DownloadStage.connecting, DownloadStage.downloading].includes(
              downloadStage,
            ) && downloadingButton}

            {downloadStage === DownloadStage.downloaded && downloadedButton}
          </>
        ) : (
          startDownloadButton
        )}
      </View>
    </View>
  );
}

const getStyles = createGetStyles(colors => ({
  footerWrapper: { paddingBottom: 26 },

  btnGroup: {
    paddingTop: 20,
    paddingHorizontal: 20,
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 'auto',
    position: 'relative',
  },

  border: {
    height: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors['neutral-bg1'],
    position: 'absolute',
    top: 0,
    left: 0,
  },

  btnContainer: {
    flexShrink: 1,
    display: 'flex',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    maxWidth: '100%',
  },

  btnGhostContainer: {
    width: 80,
    flexShrink: 1,
    maxWidth: '30%',
  },
  btnGhostColor: {
    color: colors['blue-default'],
  },

  buttonStyle: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // ...makeDebugBorder('green')
  },
  btnConfirmContainer: {},
  btnActionTitle: {
    color: colors['neutral-title-2'],
    fontSize: 16,
    ...(!isAndroid && {
      width: '100%',
    }),
    // ...makeDebugBorder('red')
  },
}));
