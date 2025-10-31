import OfflinePng from '@/assets2024/images/offline.png';
import OfflineDarkPng from '@/assets2024/images/offline-dark.png';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Trans, useTranslation } from 'react-i18next';
import {
  Image,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { RcIconWarningCircleCC } from '@/assets2024/icons/common';

interface Props {
  code: number;
  message: string;
  style?: StyleProp<ViewStyle>;
  onRefresh?: () => void;
  onOpenInBrowser?(): void;
}
export function WebviewError({
  style,
  code,
  message,
  onRefresh,
  onOpenInBrowser,
}: Props) {
  const { styles, isLight, colors2024 } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();

  return (
    <View style={[styles.container, style]}>
      <Image
        style={styles.img}
        source={isLight ? OfflinePng : OfflineDarkPng}
      />
      <View style={styles.content}>
        <Text style={styles.text}>
          {t('page.browser.WebviewError.failedToLoad')}
        </Text>
        <Text style={styles.text}>
          {t('page.browser.WebviewError.error')} {message} ({code})
        </Text>
      </View>
      <Button
        type="primary"
        title={t('global.refresh')}
        onPress={onRefresh}
        buttonStyle={styles.btn}
        titleStyle={styles.btnText}
      />
      <View style={styles.alertContainer}>
        <View style={styles.alert}>
          <RcIconWarningCircleCC color={colors2024['neutral-info']} />
          <Text style={styles.alertText}>
            <Trans t={t} i18nKey="page.browser.WebviewError.alertText">
              Try{' '}
              <Text style={styles.link} onPress={onOpenInBrowser}>
                Open in browser
              </Text>{' '}
              to check if it is a website issue
            </Trans>
          </Text>
        </View>
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 99999999999,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  img: {
    width: 163,
    height: 126,
  },
  content: {
    marginBottom: 12,
    marginTop: 4,
    paddingHorizontal: 20,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  btn: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    width: 'auto',
    height: 'auto',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  alertContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 33,
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
  },
  alert: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors2024['neutral-bg-5'],
  },
  alertText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  link: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
}));
