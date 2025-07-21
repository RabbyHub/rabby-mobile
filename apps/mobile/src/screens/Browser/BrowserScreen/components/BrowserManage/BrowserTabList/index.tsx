import { RcIconAddPlusCircle } from '@/assets2024/icons/browser';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn, useMount } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { DropDownMenuView, MenuAction } from '@/components2024/DropDownMenu';
import {
  ListRenderItem,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { BrowserTabCard } from './BrowserTabCard';
import { Tab } from '@/core/services/browserService';
// import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useRef } from 'react';

export const BrowserTabList = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const { colors2024, styles, isLight } = useTheme2024({
    getStyle,
  });
  const { tabs, activeTabId, switchToTab, closeTab, openTab, closeAllTabs } =
    useBrowser();
  const { t } = useTranslation();
  // const navigation = useRabbyAppNavigation();

  const renderItem: ListRenderItem<Tab> = useMemoizedFn(({ item, index }) => {
    return (
      <View
        style={[
          {
            width: '50%',
            position: 'relative',
          },
          index % 2 === 0
            ? {
                paddingRight: 3,
              }
            : {
                paddingLeft: 3,
              },
        ]}>
        <BrowserTabCard
          tab={item}
          isActive={activeTabId === item.id}
          onPress={tab => switchToTab(tab.id)}
          onPressClose={tab => closeTab(tab.id)}
        />
      </View>
    );
  });

  const ref = useRef<FlatList>(null);
  useMount(() => {
    setTimeout(() => {
      const index = tabs.findIndex(item => item.id === activeTabId);
      if (index !== -1) {
        ref.current?.scrollToIndex({
          index: Math.floor(index / 2),
          animated: false,
        });
      }
    }, 50);
  });
  return (
    <View style={[styles.container, style]}>
      <FlatList
        style={styles.tabList}
        data={tabs.filter(item => !!item.url)}
        renderItem={renderItem}
        numColumns={2}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={ItemSeparatorComponent}
        showsVerticalScrollIndicator={false}
        ref={ref}
        getItemLayout={(data, index) => ({
          length: 242,
          offset: 242 * index,
          index,
        })}
      />
      <View
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          ...styles.bottomArea,
          borderColor: isLight
            ? 'rgba(0, 0, 0, 0.06)'
            : 'rgba(255, 255, 255, 0.06)',
        }}>
        <DropDownMenuView
          triggerProps={{ action: 'press' }}
          menuConfig={{
            menuActions: [
              {
                title: t('page.browserManage.BrowserTabList.closeAllTabs'),
                key: 'close_all_tabs',
                icon: isLight
                  ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_clear.png')
                  : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_clear_dark.png'),
                androidIconName: isLight
                  ? 'ic_rabby_menu_clear'
                  : 'ic_rabby_menu_clear_dark',
                action: () => {
                  closeAllTabs();
                },
              },
            ],
          }}>
          <TouchableOpacity>
            <Text style={styles.bottomText}>{t('global.Edit')}</Text>
          </TouchableOpacity>
        </DropDownMenuView>
        <TouchableOpacity onPress={() => openTab()}>
          <RcIconAddPlusCircle
            width={44}
            height={44}
            color={colors2024['neutral-foot']}
            borderColor={colors2024['neutral-line']}
            backgroundColor={colors2024['neutral-bg-1']}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            // navigation.goBack();
          }}>
          <Text style={styles.bottomText}>{t('global.Done')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ItemSeparatorComponent = () => <View style={{ height: 12 }} />;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    paddingTop: 5,
    paddingBottom: 9,
    gap: 12,
    position: 'relative',
    height: '100%',
  },
  tabList: {
    paddingHorizontal: 14,
  },
  bottomArea: {
    paddingVertical: 6,
    paddingHorizontal: 35,
    paddingBottom: 30,
    borderTopWidth: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    color: colors2024['neutral-title-1'],
    fontWeight: '500',
    lineHeight: 24,
  },
}));
