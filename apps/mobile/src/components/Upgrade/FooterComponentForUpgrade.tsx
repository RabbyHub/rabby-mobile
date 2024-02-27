import { useMemo, useCallback } from 'react';
import { StyleSheet, View, Platform } from 'react-native';

import { Button } from '../Button';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { openExternalUrl } from '@/core/utils/linking';
import { APP_URLS } from '@/constant';
import { useRemoteUpgradeInfo } from '@/hooks/version';

const isAndroid = Platform.OS === 'android';

type FooterComponentProps = RNViewProps;

export default function FooterComponentForUpgrade(props: FooterComponentProps) {
  const { style } = props;

  const { styles } = useThemeStyles(getStyles);

  const { remoteVersion } = useRemoteUpgradeInfo();

  const onStartDown = useCallback(() => {
    if (!isAndroid) {
      openExternalUrl(APP_URLS.DOWNLOAD_PAGE);
      return;
    }

    openExternalUrl(remoteVersion.downloadUrl);
  }, [remoteVersion]);

  const startDownloadNode = useMemo(() => {
    return (
      <Button
        onPress={onStartDown}
        title={'Update'}
        type="primary"
        buttonStyle={[styles.buttonStyle]}
        titleStyle={[styles.btnConfirmTitle]}
        containerStyle={[styles.btnContainer, styles.btnConfirmContainer]}
      />
    );
  }, [styles, onStartDown]);

  return (
    <View style={[styles.footerWrapper, style]}>
      <View style={[styles.btnGroup]}>{startDownloadNode}</View>
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
    flex: 1,
  },
}));
