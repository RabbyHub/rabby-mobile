import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Pressable, Text, View } from 'react-native';

export const enum TabType {
  portfolio = 'portfolio',
  address = 'address',
}

interface IProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
}
export const SwitchHeader = ({ currentTab, onChangeTab }: IProps) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <Pressable onPress={() => onChangeTab(TabType.portfolio)}>
          <Text
            style={
              currentTab === TabType.portfolio ? styles.activeTab : styles.tab
            }>
            Portfolio
          </Text>
        </Pressable>
        <Pressable onPress={() => onChangeTab(TabType.address)}>
          <Text
            style={
              currentTab === TabType.address ? styles.activeTab : styles.tab
            }>
            Address
          </Text>
        </Pressable>
      </View>
      <View style={styles.right}>
        {currentTab === TabType.portfolio ? (
          <Text>chain info</Text>
        ) : (
          <Text>edit addr</Text>
        )}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tab: {},
  activeTab: {
    color: colors2024['red-dark'],
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tabs: {
    flexDirection: 'row',
    gap: 16,
  },
  right: {},
}));
