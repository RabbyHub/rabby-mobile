import { RcIconAddPlusCircle } from '@/assets2024/icons/browser';
import { Tab, useBrowser } from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import {
  Dimensions,
  ListRenderItem,
  StyleProp,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { BrowserTabCard } from './BrowserTabCard';

export const BrowserTabList = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });
  const { tabs, activeTabId, switchToTab, closeTab, openTab } = useBrowser();

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
  return (
    <View style={[styles.container, style]}>
      <FlatList
        data={tabs}
        renderItem={renderItem}
        numColumns={2}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={ItemSeparatorComponent}
        showsVerticalScrollIndicator={false}
      />
      <TouchableOpacity style={styles.addBtn} onPress={() => openTab()}>
        <RcIconAddPlusCircle
          style={styles.iconPlus}
          width={44}
          height={44}
          color={colors2024['neutral-foot']}
          borderColor={colors2024['neutral-line']}
          backgroundColor={colors2024['neutral-bg-1']}
        />
      </TouchableOpacity>
    </View>
  );
};

const ItemSeparatorComponent = () => <View style={{ height: 12 }} />;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    paddingHorizontal: 14,
    paddingTop: 5,
    paddingBottom: 9,
    gap: 12,
    position: 'relative',
    height: '100%',
  },
  addBtn: {
    position: 'absolute',
    bottom: 54,
    left: Dimensions.get('window').width / 2 - 22,
  },
  iconPlus: {},
}));
