import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';

import DeviceUtils from '@/core/utils/device';
import { default as RcTipCC } from './icons/tip-cc.svg';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { Button } from '../Button';
import { useIOSScreenIsBeingCaptured } from '@/hooks/native/security';
import {
  ProtectType,
  useAtSensitiveScreen,
  useRabbyAppNavigation,
} from '@/hooks/navigation';
import { getReadyNavigationInstance } from '@/utils/navigation';
import { BlurView } from '@react-native-community/blur';

const RcTip = makeThemeIconFromCC(RcTipCC, 'orange-default');

const isIOS = DeviceUtils.isIOS();

function useGlobalSecurityTip() {
  const { isBeingCaptured } = useIOSScreenIsBeingCaptured();
  const { atSensitiveScreen, $protectedConf } = useAtSensitiveScreen();

  return {
    shouldShowSecurityTip:
      atSensitiveScreen &&
      isBeingCaptured &&
      $protectedConf.iosBlurType === ProtectType.SafeTipModal,
    onCancel: $protectedConf.onCancel,
  };
}

/**
 * @description stub component for security tip
 */
export default function SecurityTipStubModal() {
  const { styles, colors } = useThemeStyles(getStyles);

  const { t } = useTranslation();

  const { shouldShowSecurityTip, onCancel } = useGlobalSecurityTip();

  return (
    <Modal visible={shouldShowSecurityTip} transparent animationType="fade">
      <BlurView style={styles.overlay}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modal}
          onPress={evt => {
            evt.stopPropagation();
          }}>
          <View style={styles.container}>
            <RcTip width={40} height={40} />
            <View style={styles.titleSection}>
              <Text style={styles.title}>Safety alert</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.bodyDesc}>
                For your protection, screenshots/screen recordings are disabled
                when viewing your seed phrase or private key.
              </Text>
            </View>
            <View style={styles.footerArea}>
              <Button
                type="primary"
                containerStyle={styles.buttonContainer}
                buttonStyle={styles.button}
                title={t('global.ok')}
                onPress={() =>
                  onCancel?.({ navigation: getReadyNavigationInstance() })
                }
              />
            </View>
          </View>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
}

const SIZES = {
  containerPaddingVertical: 20,
  thumbnailSize: 40,
  footer: 88,
  footerButtonHeight: 48,
};
const getStyles = createGetStyles(colors => ({
  overlay: {
    width: '100%',
    flex: 1,
    // backgroundColor: 'rgba(0, 0, 0, 0.4)',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',

    // position: 'absolute',
    // top: 0,
    // left: 0,
    // bottom: 0,
    // right: 0,
  },
  modal: {
    maxWidth: 360,
    width: '100%',
    position: 'relative',
  },
  container: {
    position: 'relative',
    maxWidth: 360,
    minHeight: 200,
    height: 304,
    marginHorizontal: 20,
    backgroundColor: colors['neutral-bg1'],
    paddingTop: SIZES.containerPaddingVertical,
    paddingBottom: SIZES.footer,
    borderRadius: 16,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  titleSection: {
    flexShrink: 0,
    paddingVertical: 16,
    position: 'relative',
    width: '100%',
  },
  title: {
    fontSize: 20,
    color: colors['neutral-title1'],
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    flexShrink: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    // ...makeDebugBorder(),
  },
  bodyDesc: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    color: colors['neutral-body'],
    textAlign: 'center',
  },
  footerArea: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    right: 0,
    height: SIZES.footer,
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopStyle: 'solid',
    justiftySelf: 'flex-end',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
    // ...makeDebugBorder(),
  },
  buttonContainer: {
    height: SIZES.footerButtonHeight,
  },
  button: {
    height: SIZES.footerButtonHeight,
  },
}));
