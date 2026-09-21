import React from 'react';
import { TouchableOpacity, View } from 'react-native';

import RcIconBanner from '@/assets2024/icons/convertDust/home-convert-guide.svg';
import RcIconArrowRightCC from '@/assets2024/icons/convertDust/right-cc.svg';
import { RcIconCloseCC } from '@/assets2024/icons/rateModal';
import { Text } from '@/components/Typography';
import { HomeBanner } from '@/components2024/HomeBanner';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { NewTag } from './NewTag';

const CLOSE_ICON_SIZE = 20;

export function ConvertDustBanner({
  onPress,
  onClose,
}: {
  onPress: () => void;
  onClose: () => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity onPress={onPress}>
        <HomeBanner
          title={
            <View style={styles.titleRow}>
              <Text style={styles.title}>
                {t('page.convertDust.homeBanner.title')}
              </Text>
              <NewTag />
            </View>
          }
          content={
            <Text style={styles.desc}>
              {t('page.convertDust.homeBanner.description')} &gt;
            </Text>
          }
          contentStyle={styles.content}
          onClose={onClose}
          mascot={<RcIconBanner />}
          closeIcon={
            <RcIconCloseCC
              color={colors2024['neutral-secondary']}
              width={CLOSE_ICON_SIZE}
              height={CLOSE_ICON_SIZE}
            />
          }
        />
      </TouchableOpacity>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  wrapper: {
    paddingHorizontal: 16,
  },
  content: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  desc: {
    width: 230,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  inlineArrowIcon: {},
}));
