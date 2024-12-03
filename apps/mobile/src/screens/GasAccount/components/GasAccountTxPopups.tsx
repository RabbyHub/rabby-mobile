import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GasAccountBlueLogo } from './GasAccountBlueLogo';
import { GasAccountWrapperBg } from './WrapperBg';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { RcIconQuoteEnd, RcIconQuoteStart } from '@/assets/icons/gas-account';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

const tipPngSource = require('@/assets/icons/gas-account/gas-account-deposit-tip-2024.png');

interface PopupProps {
  visible: boolean;
  onClose: () => void;
}

const GasAccountDepositTipContent = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: bottom }]}>
      <BottomSheetHandlableView>
        <Text style={styles.title}>
          {t('page.gasAccount.GasAccountDepositTipPopup.title')}
        </Text>
      </BottomSheetHandlableView>
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
  const { styles } = useTheme2024({ getStyle });

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
      snapPoints={[380]}
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

  const { styles } = useTheme2024({ getStyle });

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
  const { styles } = useTheme2024({ getStyle });

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
      snapPoints={[540]}
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

const getStyle = createGetStyles2024(ctx => ({
  bottomBg: {
    backgroundColor: ctx.colors['neutral-bg-2'],
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
    color: ctx.colors['neutral-title1'],
    marginVertical: 24,
  },
  image: {
    marginTop: 16,
    width: 337,
    height: 144,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderTopColor: ctx.colors['neutral-line'],
    marginTop: 'auto',
    paddingHorizontal: 20,
  },
  button: {
    height: 48,
    backgroundColor: ctx.colors['blue-default'],
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderRadius: 8,
  },
  buttonText: {
    color: ctx.colors['neutral-title2'],
  },
  bottomSheet: {
    padding: 0,
  },
  logo: {
    marginVertical: 24,
  },
  scrollableView: {
    flexShrink: 1,
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
    color: ctx.colors['blue-default'],
  },
  quoteEnd: {
    position: 'absolute',
    top: 0,
    right: -20,
  },
}));
