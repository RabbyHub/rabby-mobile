import { Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import RcIconPointsStar from '@/assets2024/icons/points/rabby-points-star.svg';
import RcIconClaimComingCC from '@/assets2024/icons/points/claim-coming-cc.svg';
import { createGetStyles2024 } from '@/utils/styles';

export const InfoBanner = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <View style={styles.banner}>
      <RcIconPointsStar />
      <View>
        <Text style={styles.bannerTitle}>
          {t('page.rabbyPoints.titleWithStar')}
        </Text>
        <RcIconClaimComingCC color={colors2024['neutral-body']} />
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  banner: {
    borderRadius: 12,
    padding: 20,
    backgroundColor: ctx.colors2024['brand-light-1'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 90,
  },
  bannerTitle: {
    fontSize: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '900',
    color: ctx.colors2024['neutral-title-1'],
    lineHeight: 22,
    marginBottom: 6,
  },
}));
