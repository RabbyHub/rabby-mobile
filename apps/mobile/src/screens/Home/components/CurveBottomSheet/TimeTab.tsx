import { toast } from '@/components/Toast';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { Tab } from '@rneui/base';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { View, Pressable, Text } from 'react-native';

export type TabKey = (typeof TIME_TAB_LIST)[number]['key'];

export const TIME_TAB_LIST = [
  {
    label: '24h',
    key: '24h' as const,
    value: [0, dayjs()],
  },
  {
    label: '1W',
    key: '1W' as const,
    value: [dayjs().add(-7, 'd'), dayjs()],
  },
  {
    label: '1M',
    key: '1M' as const,
    value: [dayjs().add(-30, 'd'), dayjs()],
  },
  {
    label: '1Y',
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

export const TimeTab = ({
  activeKey,
  onPress,
}: {
  activeKey: TabKey;
  onPress: (key: TabKey) => void;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <Tab
      value={TIME_TAB_LIST?.findIndex(e => e.key === activeKey)}
      onChange={(v: number) => {
        onPress(TIME_TAB_LIST[v].key);
      }}
      disableIndicator
      dense
      style={styles.listContainer}>
      {TIME_TAB_LIST.map(item => (
        <Tab.Item
          key={item.key}
          buttonStyle={[styles.item, item.key === activeKey && styles.active]}
          titleStyle={[
            styles.itemText,
            item.key === activeKey && styles.activeText,
          ]}>
          {item.label}
        </Tab.Item>
      ))}
    </Tab>
  );
};

const getStyles = createGetStyles(colors => ({
  listContainer: {
    backgroundColor: colors['neutral-card2'],
    padding: 2,
    borderRadius: 6,
    width: '100%',
    flexDirection: 'row',
    height: 32,
    zIndex: 9999,
  },
  item: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginHorizontal: 0,
    marginVertical: 0,
  },
  itemText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors['neutral-body'],
  },
  activeText: {
    color: colors['blue-default'],
  },
  active: {
    color: colors['neutral-body'],
  },
}));
