import ImgGasAccount from '@/assets2024/images/gasAccount/gasaccount-new.png';
import {
  RcIconBenefitNetworks,
  RcIconBenefitNoFee,
  RcIconBenefitTransactions,
} from '@/assets2024/icons/gas-account';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

type BenefitItem = {
  title: string;
  description: string;
  icon: React.FC<SvgProps>;
};

const BenefitRow: React.FC<BenefitItem> = ({ title, description, icon }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const Icon = icon;

  return (
    <View style={styles.benefitRow}>
      <View style={styles.iconWrap}>
        <Icon width={24} height={24} color={colors2024['neutral-title-1']} />
      </View>
      <View style={styles.benefitContent}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDescription}>{description}</Text>
      </View>
    </View>
  );
};

export const GasAccountBenefitsCard: React.FC<{
  title?: string;
  subtitle?: string;
  items?: BenefitItem[];
  style?: StyleProp<ViewStyle>;
}> = ({
  title = 'Pay Gas Fees on All chains',
  subtitle = "when you're out of gas",
  items,
  style,
}) => {
  const { t } = useTranslation();
  const { styles, isLight } = useTheme2024({ getStyle });

  const DEFAULT_ITEMS = React.useMemo(
    () => [
      {
        title: t('page.gasAccount.benefitCard.item1'),
        description: t('page.gasAccount.benefitCard.desc1'),
        icon: RcIconBenefitNoFee,
      },
      {
        title: t('page.gasAccount.benefitCard.item2'),
        description: t('page.gasAccount.benefitCard.desc2'),

        icon: RcIconBenefitNetworks,
      },
      {
        title: t('page.gasAccount.benefitCard.item3'),

        description: t('page.gasAccount.benefitCard.desc3'),

        icon: RcIconBenefitTransactions,
      },
    ],
    [t],
  );

  return (
    <View
      style={[styles.container, isLight ? styles.containerLight : null, style]}>
      <View style={styles.heroWrap}>
        <Image source={ImgGasAccount} style={styles.heroImage} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.benefits}>
        {(items || DEFAULT_ITEMS).map(item => (
          <BenefitRow
            key={`${item.title}-${item.description}`}
            title={item.title}
            description={item.description}
            icon={item.icon}
          />
        ))}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    width: '100%',
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-3'],
    alignItems: 'center',
    overflow: 'hidden',
  },
  containerLight: {
    shadowColor: '#192945',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },
  heroWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroImage: {
    width: 123,
    height: 99,
    // resizeMode: 'contain',
  },
  header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    gap: 4,
  },
  title: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  benefits: {
    width: '100%',
    gap: 12,
  },
  benefitRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-5'],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-line'],
  },
  benefitContent: {
    flex: 1,
    gap: 4,
  },
  benefitTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  benefitDescription: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
}));
