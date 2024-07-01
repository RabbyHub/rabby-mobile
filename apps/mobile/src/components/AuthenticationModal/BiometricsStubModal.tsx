import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';

import {
  RcIconKeychainFaceIdCC,
  RcIconKeychainFingerprintCC,
} from '@/assets/icons/lock';
import ThemeIcon from '../ThemeMode/ThemeIcon';
import DeviceUtils from '@/core/utils/device';
import TouchableView from '../Touchable/TouchableView';
import { useVerifyByBiometrics } from '@/hooks/biometrics';
import { RcIconCloseCC } from '@/assets/icons/common';

const isIOS = DeviceUtils.isIOS();
/**
 * @description stub component for biometrics process
 */
export default function BiometricsStubModal() {
  const { styles, colors } = useThemeStyles(getStyles);

  const { t } = useTranslation();

  const {
    isProcessBiometrics,
    shouldShowStubModal,
    verifyByBiometrics,
    abortBiometricsVerification,
  } = useVerifyByBiometrics();

  return (
    <Modal visible={shouldShowStubModal} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        onPress={() => {
          abortBiometricsVerification();
        }}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modal}
          onPress={evt => {
            evt.stopPropagation();
          }}>
          <View style={styles.container}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>
                {t('component.AuthenticationModals.processBiometrics.title')}
              </Text>
              <TouchableView
                onPress={abortBiometricsVerification}
                style={styles.closeIconWrapper}>
                <ThemeIcon
                  src={RcIconCloseCC}
                  width={SIZES.closeIconSpace}
                  height={SIZES.closeIconSpace}
                  color={colors['neutral-foot']}
                />
              </TouchableView>
            </View>
            <View style={styles.body}>
              <TouchableView
                style={{
                  width: SIZES.thumbnailSize,
                  height: SIZES.thumbnailSize,
                }}
                onPress={evt => {
                  evt.stopPropagation();
                  verifyByBiometrics();
                }}>
                {(!isProcessBiometrics && (
                  <ThemeIcon
                    src={
                      isIOS
                        ? RcIconKeychainFaceIdCC
                        : RcIconKeychainFingerprintCC
                    }
                    // style={StyleSheet.flatten([isProcessBiometrics && { opacity: 0 }])}
                    svgSize={SIZES.thumbnailSize}
                    color={colors['neutral-body']}
                  />
                )) ||
                  null}
              </TouchableView>
              <Text style={styles.bodyDesc}>
                {t('component.AuthenticationModals.processBiometrics.desc')}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const SIZES = {
  containerPaddingVertical: 8,
  closeIconSpace: 20,
  thumbnailSize: 40,
};
const getStyles = createGetStyles(colors => ({
  // centeredView: {
  //   flex: 1,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   marginTop: 22,
  // },
  overlay: {
    width: '100%',
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    maxWidth: 360,
    width: '100%',
    position: 'relative',
  },
  container: {
    maxWidth: 360,
    minHeight: 200,
    height: 240,
    marginHorizontal: 20,
    backgroundColor: colors['neutral-bg1'],
    paddingVertical: SIZES.containerPaddingVertical,
    borderRadius: 16,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleSection: {
    flexShrink: 0,
    height: 32,
    position: 'relative',
    // ...makeDebugBorder(),
    width: '100%',
    justifyContent: 'flex-end',
  },
  closeIconWrapper: {
    height: SIZES.closeIconSpace + SIZES.containerPaddingVertical * 2,
    width: SIZES.closeIconSpace + SIZES.containerPaddingVertical * 2,
    position: 'absolute',
    right: 0,
    top: -SIZES.containerPaddingVertical,
    paddingTop: SIZES.containerPaddingVertical,
    // ...makeDebugBorder(),
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    color: colors['neutral-title1'],
    fontWeight: '500',
    textAlign: 'center',
  },
  body: {
    flexShrink: 1,
    paddingHorizontal: 20,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyDesc: {
    marginTop: 24,
    fontSize: 16,
    color: colors['neutral-body'],
    textAlign: 'center',
  },
}));
