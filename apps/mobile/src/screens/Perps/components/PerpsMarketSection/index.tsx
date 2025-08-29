import { RcArrowRight2CC } from '@/assets/icons/common';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { PerpsMarketItem } from './PerpsMarketItem';

export const PerpsMarketSection: React.FC<{
  marketData: MarketData[];
}> = ({ marketData }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();

  const list = useMemo(() => {
    return marketData.slice(0, 3);
  }, [marketData]);

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Explore Perps</Text>
        <TouchableOpacity
          onPress={() => {
            navigation.push(RootNames.StackTransaction, {
              screen: RootNames.PerpsMarketList,
            });
          }}>
          <View style={styles.sectionAction}>
            <Text style={styles.sectionActionText}>{t('View All')}</Text>
            <RcArrowRight2CC color={colors2024['neutral-foot']} />
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {list.map(item => {
          return (
            <PerpsMarketItem
              key={item.name}
              item={item}
              onPress={() => {
                navigation.push(RootNames.StackTransaction, {
                  screen: RootNames.PerpsMarketDetail,
                  params: {
                    market: item.name,
                  },
                });
              }}
            />
          );
        })}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {},
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  sectionAction: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionActionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    textAlign: 'right',
  },
  sectionActionIcon: {
    width: 16,
    height: 16,
    marginLeft: 4,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
}));
