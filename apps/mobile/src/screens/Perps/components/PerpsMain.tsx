import { RcIconLong } from '@/assets2024/icons/perps';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  SectionList,
  Text,
  Touchable,
  TouchableOpacity,
  View,
} from 'react-native';
import { PerpsPositionItem } from './PerpsPositionItem';
import { head } from 'lodash';
import { useMemoizedFn } from 'ahooks';
import { red } from 'bn.js';
import { PerpsMarketItem } from './PerpsMarketItem';
import { PerpsHistoryItem } from './PerpsHistoryItem';
import { RcArrowRight2CC } from '@/assets/icons/common';
import { PerpsHistoryEmpty } from './PerpsHistoryEmpty';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';

export const PerpsMain: React.FC<{
  ListHeaderComponent?: React.ReactElement;
}> = ({ ListHeaderComponent }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();

  const sections = [
    {
      title: 'Positions',
      type: 'position' as const,
      data: [
        {
          enum: 'BTC-USD',
          price: '$114,539.00',
          leverage: 'Short 10x',
          change: '+$24.32 (+0.87%)',
        },
        // Add more items as needed
      ],
    },
    {
      title: 'Explore Perps',
      type: 'market' as const,
      data: [
        {
          enum: 'ETH-USD',
          price: '$3,200.00',
          leverage: 'Long 5x',
          change: '+$100.00 (+3.23%)',
        },
        // Add more items as needed
      ],
    },
    {
      title: 'History',
      type: 'history' as const,
      data: [
        // {
        //   enum: 'ETH-USD',
        //   price: '$3,200.00',
        //   leverage: 'Long 5x',
        //   change: '+$100.00 (+3.23%)',
        // },
        // // Add more items as needed
      ] as any,
    },
  ];

  const renderItem = useMemoizedFn(
    ({ item, section }: { item: any; section: (typeof sections)[number] }) => {
      if (section.type === 'position') {
        return <PerpsPositionItem />;
      }
      if (section.type === 'market') {
        return <PerpsMarketItem />;
      }
      if (section.type === 'history') {
        return <PerpsHistoryItem />;
      }
      return null;
    },
  );

  const renderSectionHeader = useMemoizedFn(
    ({ section }: { section: (typeof sections)[number] }) => {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.type === 'market' ? (
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
            ) : null}
          </View>
          {section.type === 'history' && !section.data?.length ? (
            <PerpsHistoryEmpty />
          ) : null}
        </>
      );
    },
  );

  return (
    <SectionList
      sections={sections}
      style={styles.list}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeaderComponent}
      // onScrollBeginDrag={onScrollBeginDrag}
      // style={[styles.chainListContainer, style]}
      // keyExtractor={(item, idx) => `${item.enum}-${idx}`}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {},
  list: {
    flex: 1,
  },
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
}));
