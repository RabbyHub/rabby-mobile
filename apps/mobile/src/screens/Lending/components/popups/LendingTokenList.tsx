import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import {
  GlobalModalViewProps,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import { LendingSupplyListContent } from './SupplyList';
import { LendingBorrowListContent } from './BorrowList';

type LendingTokenListTab = 'supply' | 'borrow';

const TAB_KEYS: LendingTokenListTab[] = ['supply', 'borrow'];

const LendingTokenList: React.FC<
  GlobalModalViewProps<MODAL_NAMES.LENDING_TOKEN_LIST> & {
    initialTab?: LendingTokenListTab;
    onBeforeSwapNavigate?: () => void;
  }
> = ({ initialTab = 'supply', onBeforeSwapNavigate }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const pagerRef = useRef<PagerView>(null);
  const initialIndex = initialTab === 'borrow' ? 1 : 0;
  const [activeTab, setActiveTab] = useState<LendingTokenListTab>(initialTab);

  const tabs = useMemo(
    () => [
      {
        key: 'supply' as const,
        label: t('page.Lending.supplyDetail.actions'),
      },
      {
        key: 'borrow' as const,
        label: t('page.Lending.borrowDetail.actions'),
      },
    ],
    [t],
  );

  const handleChangeTab = useCallback((tab: LendingTokenListTab) => {
    setActiveTab(tab);
    pagerRef.current?.setPage(TAB_KEYS.indexOf(tab));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {tabs.map(item => {
          const isActive = item.key === activeTab;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              key={item.key}
              onPress={() => handleChangeTab(item.key)}
              style={[styles.tabItem, isActive && styles.tabItemActive]}>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.pagerContainer}>
        <PagerView
          initialPage={initialIndex}
          onPageSelected={event => {
            setActiveTab(TAB_KEYS[event.nativeEvent.position] || 'supply');
          }}
          ref={pagerRef}
          style={styles.pager}>
          <View collapsable={false} key="supply" style={styles.page}>
            <LendingSupplyListContent
              hideHeader
              onBeforeSwapNavigate={onBeforeSwapNavigate}
            />
          </View>
          <View collapsable={false} key="borrow" style={styles.page}>
            <LendingBorrowListContent hideHeader />
          </View>
        </PagerView>
      </View>
    </View>
  );
};

export default LendingTokenList;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
    paddingTop: 12,
  },
  tabBar: {
    marginHorizontal: 16,
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 10,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
  },
  tabItem: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: isLight
      ? '#131416'
      : colors2024['neutral-InvertHighlight'],
  },
  tabText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  tabTextActive: {
    fontWeight: '700',
    color: isLight
      ? colors2024['neutral-InvertHighlight']
      : colors2024['neutral-black'],
  },
  pagerContainer: {
    flex: 1,
    marginTop: 12,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
}));
