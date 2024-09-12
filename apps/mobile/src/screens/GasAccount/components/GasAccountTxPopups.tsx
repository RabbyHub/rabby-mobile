import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GasAccountBlueLogo } from './GasAccountBlueLogo';
import { GasAccountWrapperBg } from './WrapperBg';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { RcIconQuoteEnd, RcIconQuoteStart } from '@/assets/icons/gas-account';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const tipPngSource = require('@/assets/icons/gas-account/gas-account-deposit-tip.png');

interface PopupProps {
  visible: boolean;
  onClose: () => void;
}

const GasAccountDepositTipContent = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: bottom }]}>
      <Text style={styles.title}>
        {t('page.gasAccount.GasAccountDepositTipPopup.title')}
      </Text>
      <Image source={tipPngSource} style={styles.image} resizeMode="contain" />
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>
            {t('page.gasAccount.GasAccountDepositTipPopup.gotIt')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const GasAccountDepositTipPopup = ({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);

  const bottomRef = useRef<BottomSheetModalMethods>(null);

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [visible]);
  return (
    <AppBottomSheetModal
      snapPoints={[363]}
      ref={bottomRef}
      onDismiss={onClose}
      enableDismissOnClose
      handleStyle={styles.bottomBg}
      backgroundStyle={styles.bottomBg}>
      <BottomSheetView>
        <GasAccountDepositTipContent onClose={onClose} />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const GasAccountLoginTipContent = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);

  const { bottom } = useSafeAreaInsets();

  return (
    <GasAccountWrapperBg
      style={[styles.container, { paddingBottom: bottom || 0 }]}>
      <GasAccountBlueLogo style={styles.logo} />
      <View style={styles.quoteContainer}>
        <RcIconQuoteStart style={styles.quoteStart} />
        <Text style={styles.quoteText}>
          {t('page.gasAccount.loginInTip.title')}
        </Text>
      </View>
      <View style={styles.quoteContainer}>
        <Text style={styles.quoteText}>
          {t('page.gasAccount.loginInTip.desc')}
        </Text>
        <RcIconQuoteEnd style={styles.quoteEnd} />
      </View>
      <Image source={tipPngSource} style={styles.image} resizeMode="contain" />
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>
            {t('page.gasAccount.GasAccountDepositTipPopup.gotIt')}
          </Text>
        </TouchableOpacity>
      </View>
    </GasAccountWrapperBg>
  );
};

export const GasAccountLogInTipPopup = ({ visible, onClose }: PopupProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);

  const bottomRef = useRef<BottomSheetModalMethods>(null);

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      snapPoints={[530]}
      ref={bottomRef}
      onDismiss={onClose}
      enableDismissOnClose
      handleStyle={styles.bottomBg}
      backgroundStyle={styles.bottomBg}>
      <BottomSheetView>
        <GasAccountLoginTipContent onClose={onClose} />
        {/* <View style={{ height: bottom }} /> */}
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles(colors => ({
  bottomBg: {
    backgroundColor: colors['neutral-bg-2'],
  },
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: colors['neutral-title1'],
    marginVertical: 24,
  },
  image: {
    marginTop: 16,
    width: 336,
    height: 144,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderTopColor: colors['neutral-line'],
    marginTop: 'auto',
    paddingHorizontal: 20,
  },
  button: {
    height: 48,
    backgroundColor: colors['blue-default'],
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderRadius: 8,
  },
  buttonText: {
    color: colors['neutral-title2'],
  },
  bottomSheet: {
    padding: 0,
  },
  logo: {
    marginVertical: 24,
  },
  quoteContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  quoteStart: {
    position: 'absolute',
    top: 0,
    left: -20,
  },
  quoteText: {
    fontSize: 18,
    fontWeight: '500',
    color: colors['blue-default'],
  },
  quoteEnd: {
    position: 'absolute',
    top: 0,
    right: -20,
  },
}));
