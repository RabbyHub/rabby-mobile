import { toast } from '@/components/Toast';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { Tab } from '@rneui/base';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { Text, TouchableWithoutFeedback, View } from 'react-native';
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
    value: [dayjs().add(-30, 'd'), dayjs()],
  },
  {
    label: '1 Year',
    key: '1Y' as const,
    value: [dayjs().add(-90, 'd'), dayjs()],
  },
  {
    label: 'Max',
    key: 'Max' as const,
    value: [0, dayjs()],
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

export const REAL_TIME_TAB_LIST = ['24h'];

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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
  },
  itemActive: {
    // todo
    // backgroundColor: colors2024['neutral-bg-1'],
    backgroundColor: '#131416',
    paddingHorizontal: 13.5,
    paddingVertical: 5,
    borderRadius: 120,
  },
}));
