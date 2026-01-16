import React, { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';

import RcIconRabby from '@/assets2024/icons/common/rabby-wallet.svg';
import RcIconHyperliquid from '@/assets2024/icons/perps/IconHyperliquid.svg';

import { RcIconCloseCC } from '@/assets/icons/common';
import { AppBottomSheetModal } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { toast } from '@/components2024/Toast';
import { IS_ANDROID } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useRequest, useUnmount } from 'ahooks';
import { useTranslation } from 'react-i18next';

interface Props {
  visible?: boolean;
  onClose?: () => void;
  onInvite?: () => void;
  onUnmount?: () => void;
  footer?: React.ReactNode;
}

export const PerpsInvitePopup: React.FC<Props> = ({
  visible,
  onClose,
  onInvite,
  onUnmount,
  footer,
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

  const { runAsync: handleInvite, loading } = useRequest(
    async () => {
      await onInvite?.();
    },
    {
      manual: true,
      onSuccess() {
        toast.success(t('page.perps.invitePopup.activatedSuccess'));
      },
      onError(e) {
        toast.error(t('page.perps.invitePopup.activatedFailed'));
        console.error('activate perps invite failed', e);
      },
    },
  );

  useUnmount(() => {
    onUnmount?.();
  });

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
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}>
      <BottomSheetView>
        <AutoLockView
          style={[
            styles.container,
            {
              paddingBottom: IS_ANDROID
                ? Math.max(androidOnlyBottomOffset, 16)
                : footer
                ? androidOnlyBottomOffset
                : 48,
            },
          ]}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {t('page.perps.invitePopup.title')}
            </Text>
          </View>
          <View style={styles.body}>
            <View style={styles.content}>
              <View style={styles.banner}>
                <View style={styles.bannerItem}>
                  <RcIconHyperliquid style={styles.bannerIcon} />
                  <Text style={styles.bannerText}>Hyperliquid</Text>
                </View>
                <RcIconCloseCC
                  width={14}
                  height={14}
                  color={colors2024['neutral-foot']}
                />
                <View style={styles.bannerItem}>
                  <RcIconRabby style={styles.bannerIcon} />
                  <Text style={styles.bannerText}>Rabby Wallet</Text>
                </View>
              </View>
              <View>
                <Text style={styles.infoText}>
                  {t('page.perps.invitePopup.description')}
                </Text>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>4%</Text>
                  <Text style={styles.offText}>Off</Text>
                </View>
                <Text style={styles.desc}>
                  {t('page.perps.invitePopup.hyperliquidFee')}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.footer, footer ? { marginBottom: 20 } : {}]}>
            <Button
              title={t('page.perps.invitePopup.activateNow')}
              type="primary"
              onPress={handleInvite}
              loading={loading}
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
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingBottom: 20,
    paddingHorizontal: 11,

    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  desc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
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
  },

  banner: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: colors2024['neutral-bg-5'],

    marginBottom: 20,
  },

  bannerItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  bannerIcon: {
    width: 14,
    height: 14,
  },

  bannerText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '400',
    color: colors2024['neutral-body'],
  },

  infoText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-foot'],
  },

  codeBox: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
  },

  codeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '800',
    color: colors2024['brand-default'],
  },
  offText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
}));
