import { Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import RcIconPointsStar from '@/assets2024/icons/points/rabby-points-start.svg';
import RcIconClaimComing from '@/assets2024/icons/points/claim-coming-cc.svg';
import { createGetStyles2024 } from '@/utils/styles';

export const InfoBanner = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <View style={styles.banner}>
      <RcIconPointsStar />
      <View>
        <Text style={styles.bannerTitle}>
          {t('page.rabbyPoints.titleWithStar')}
        </Text>
        <RcIconClaimComing />
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  banner: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['brand-light-1']
      : ctx.colors2024['brand-light-4'],
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerTitle: {
    fontSize: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    color: ctx.colors2024['neutral-title-1'],
    marginBottom: 8,
  },
}));
