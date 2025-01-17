import React, { useEffect, useRef } from 'react';
import { View, Text, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GasAccountBlueLogo } from './GasAccountBlueLogo';
import { GasAccountWrapperBg } from './WrapperBg';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { RcIconQuoteEnd, RcIconQuoteStart } from '@/assets/icons/gas-account';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { Button } from '@/components2024/Button';

const loginTipPngSource = require('@/assets/icons/gas-account/gas-account-deposit-tip-2024-new.png');

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
      <Image
        source={loginTipPngSource}
        style={styles.loginImage}
        resizeMode="contain"
      />
      <View style={styles.buttonContainer}>
        <Button
          title={t('page.gasAccount.GasAccountDepositTipPopup.gotIt')}
          containerStyle={{ flex: 1 }}
          onPress={onClose}
        />
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
      snapPoints={[600]}
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
      <Image
        source={loginTipPngSource}
        style={styles.loginImage}
        resizeMode="contain"
      />
      <View style={styles.buttonContainer}>
        <Button
          title={t('page.gasAccount.GasAccountDepositTipPopup.gotIt')}
          containerStyle={{ flex: 1 }}
          onPress={onClose}
        />
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
      snapPoints={[734]}
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
  loginImage: {
    marginTop: 16,
    width: 257,
    height: 335.142,
  },
  image: { marginTop: 16, width: 337, height: 144 },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
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
    color: ctx.colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  quoteEnd: {
    position: 'absolute',
    top: 0,
    right: -20,
  },
}));
