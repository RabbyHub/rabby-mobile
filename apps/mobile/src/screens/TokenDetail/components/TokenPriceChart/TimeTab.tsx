import { ThemeColors2024 } from '@/constant/theme';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import dayjs from 'dayjs';
import { Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

export type TabKey = (typeof TIME_TAB_LIST)[number]['key'];

export const TIME_TAB_LIST = [
  {
    label: '24h',
    key: '24h' as const,
    value: [0, dayjs()],
  },
  {
    label: '1 Week',
    key: '1W' as const,
    value: [dayjs().add(-7, 'd'), dayjs()],
  },
  {
    label: '1 Month',
    key: '1M' as const,
    value: [dayjs().add(-1, 'month'), dayjs()],
  },
  {
    label: '1 Year',
    key: '1Y' as const,
    value: [dayjs().add(-1, 'year'), dayjs()],
  },
].map(item => {
  const v0 = item.value[0];
  const v1 = item.value[1];

  return {
    ...item,
    value: [
      typeof v0 === 'number' ? v0 : v0.utcOffset(0).startOf('day').unix(),
      typeof v1 === 'number' ? v1 : v1.utcOffset(0).startOf('day').unix(),
    ],
  };
});

export const REAL_TIME_TAB_LIST: TabKey[] = ['24h', '1W'];

export const TimeTab = ({
  activeKey,
  onPress,
}: {
  activeKey: TabKey;
  onPress: (key: TabKey) => void;
}) => {
  const { styles } = useTheme2024({
    getStyle,
  });

  return (
    <View style={styles.listContainer}>
      {TIME_TAB_LIST.map(item => {
        const isActive = item.key === activeKey;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => {
              onPress?.(item.key);
            }}>
            <View style={[styles.item, isActive ? styles.itemActive : null]}>
              <Text
                style={[styles.itemText, isActive ? styles.activeText : null]}>
                {item.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  listContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  item: {},
  itemText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  activeText: {
    color: isLight ? '#fff' : '#192945',
    fontWeight: '700',
  },
  itemActive: {
    backgroundColor: isLight
      ? ThemeColors2024.dark['neutral-bg-1']
      : ThemeColors2024.light['neutral-bg-1'],
    paddingHorizontal: 13.5,
    paddingVertical: 5,
    borderRadius: 8,
  },
}));
