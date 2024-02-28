import { useMemo, useCallback } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import ApkInstaller from '@isudaji/react-native-install-apk';

import { Button } from '../Button';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { openExternalUrl } from '@/core/utils/linking';
import { APP_URLS } from '@/constant';
import {
  DownloadStage,
  useDownloadLatestApk,
  useRemoteUpgradeInfo,
} from '@/hooks/version';

const isAndroid = Platform.OS === 'android';

type FooterComponentProps = RNViewProps;

export default function FooterComponentForUpgrade(props: FooterComponentProps) {
  const { style } = props;

  const { styles } = useThemeStyles(getStyles);

  const {
    downloadStage,
    progressPercentText,
    progressInfo: { downloadResult, downloadedApkPath },
    startDownload,
    resetProgress,
  } = useDownloadLatestApk();

  const onStartDownload = useCallback(async () => {
    if (!isAndroid) {
      openExternalUrl(APP_URLS.DOWNLOAD_PAGE);
      return;
    }

    return startDownload();
  }, [startDownload]);

  const startDownloadNode = useMemo(() => {
    return (
      <Button
        onPress={onStartDownload}
        title={'Update'}
        type="primary"
        buttonStyle={[styles.buttonStyle]}
        titleStyle={[styles.btnConfirmTitle]}
        containerStyle={[styles.btnContainer]}
      />
    );
  }, [styles, onStartDownload]);

  const downloadingNode = useMemo(() => {
    const isConnecting = downloadStage === DownloadStage.connecting;

    return (
      <Button
        onPress={() => {}}
        loading
        showTitleOnLoading
        title={
          isConnecting ? 'Connecting' : `Downloading ${progressPercentText}`
        }
        type="primary"
        loadingStyle={{ marginRight: 6 }}
        buttonStyle={[styles.buttonStyle]}
        titleStyle={[styles.btnConfirmTitle]}
        containerStyle={[styles.btnContainer]}
      />
    );
  }, [styles, progressPercentText, downloadStage]);

  const downloadedNode = useMemo(() => {
    return (
      <Button
        onPress={() => {
          if (downloadResult?.statusCode === 200) {
            ApkInstaller.install(downloadedApkPath);
            // openExternalUrl(result.targetFilepath);
          }
          setTimeout(() => resetProgress(), 200);
        }}
        title="Install and Restart"
        type="success"
        loadingStyle={{ marginRight: 6 }}
        buttonStyle={[styles.buttonStyle]}
        titleStyle={[styles.btnConfirmTitle]}
        containerStyle={[styles.btnContainer]}
      />
    );
  }, [styles, resetProgress, downloadResult, downloadedApkPath]);

  return (
    <View style={[styles.footerWrapper, style]}>
      <View style={[styles.btnGroup]}>
        {isAndroid ? (
          <>
            {downloadStage === DownloadStage.none && startDownloadNode}
            {[DownloadStage.connecting, DownloadStage.downloading].includes(
              downloadStage,
            ) && downloadingNode}

            {downloadStage === DownloadStage.downloaded && downloadedNode}
          </>
        ) : (
          startDownloadNode
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

  buttonStyle: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancelContainer: {
    borderColor: colors['blue-default'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnCancelTitle: {
    color: colors['blue-default'],
    flex: 1,
  },
  btnConfirmContainer: {},
  btnConfirmTitle: {
    color: colors['neutral-title-2'],
    fontSize: 16,
  },
}));
