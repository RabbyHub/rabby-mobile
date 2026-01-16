import React, { useEffect, useMemo, useRef } from 'react';
import { Image, Text, View } from 'react-native';

import ImageInviteDark from '@/assets2024/icons/perps/hyperliquid-invite-dark.png';
import ImageInviteLight from '@/assets2024/icons/perps/hyperliquid-invite-light.png';
import ImageAsterDark from '@/assets2024/icons/perps/aster-invite-dark.png';
import ImageAsterLight from '@/assets2024/icons/perps/aster-invite-light.png';

import { AppBottomSheetModal } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { IS_ANDROID } from '@/core/native/utils';
import { preferenceService } from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useUnmount } from 'ahooks';
import { Trans, useTranslation } from 'react-i18next';

interface Props {
  visible?: boolean;
  onClose?: () => void;
  onInvite?: () => void;
  onUnmount?: () => void;
  footer?: React.ReactNode;
  type?: 'hyperliquid' | 'aster';
}

export const AsterPerpsInvitePopup: React.FC<Props> = ({
  visible,
  onClose,
  onInvite,
  onUnmount,
  footer,
  type = 'aster',
}) => {
  const { colors2024, styles, isLight } = useTheme2024({
    getStyle,
  });

  const { t } = useTranslation();

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  const { androidOnlyBottomOffset } = useSafeSizes();

  useUnmount(() => {
    onUnmount?.();
  });

  const sourceImage = useMemo(() => {
    if (type === 'hyperliquid') {
      return isLight ? ImageInviteLight : ImageInviteDark;
    }
    return isLight ? ImageAsterLight : ImageAsterDark;
  }, [type, isLight]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      // snapPoints={[400]}
      style={{}}
      enableDynamicSizing
      onChange={index => {
        if (index === -1 && visible) {
          onClose?.();
        }
      }}
      {...makeBottomSheetProps({
        colors: colors2024,
        // linearGradientType: isLight ? 'bg0' : 'bg1',
        linearGradientType: 'bg1',
      })}>
      <BottomSheetView>
        <AutoLockView
          style={[
            styles.container,
            {
              paddingBottom: IS_ANDROID
                ? Math.max(androidOnlyBottomOffset, 16)
                : androidOnlyBottomOffset,
            },
          ]}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {type === 'hyperliquid'
                ? t('page.browser.HyperliquidInvitePopup.title')
                : t('page.browser.HyperliquidInvitePopup.asterTitle')}
            </Text>
          </View>
          <View style={styles.body}>
            <View style={styles.content}>
              <Image
                source={sourceImage}
                style={styles.image}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.desc}>
                  <Trans
                    t={t}
                    i18nKey={
                      type === 'hyperliquid'
                        ? t('page.browser.HyperliquidInvitePopup.desc')
                        : t('page.browser.HyperliquidInvitePopup.asterDesc')
                    }
                    components={{
                      1: <Text style={styles.strong} />,
                    }}
                  />
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.footer}>
            <Button
              title={t('page.browser.HyperliquidInvitePopup.btn')}
              type="primary"
              onPress={onInvite}
            />
          </View>
          {footer}
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  handleStyle: {
    backgroundColor: colors2024['neutral-bg-0'],
  },
  container: {
    // backgroundColor: isLight
    //   ? colors2024['neutral-bg-0']
    //   : colors2024['neutral-bg-1'],
    // height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  image: {
    width: 201,
    height: 74,
  },
  dappIcon: {
    width: 23,
    height: 23,
    borderRadius: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  content: {
    borderRadius: 16,
    // backgroundColor: isLight
    //   ? colors2024['neutral-bg-1']
    //   : colors2024['neutral-bg-2'],
    backgroundColor: colors2024['neutral-bg-2'],
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 11,

    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    justifyContent: 'center',
  },
  desc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-foot'],
    textAlign: 'center',
  },
  strong: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  footer: {
    paddingHorizontal: 20,
    marginBottom: 22,
  },
}));
