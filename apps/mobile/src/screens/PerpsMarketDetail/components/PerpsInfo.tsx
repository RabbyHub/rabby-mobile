import { RcIconInfoFillCC } from '@/assets/icons/common';
import { RcIconLong } from '@/assets2024/icons/perps';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export const PerpsInfo: React.FC<{}> = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Info</Text>
      </View>
      <View style={styles.list}>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>24h Volumn</Text>
          </View>
          <View>
            <Text style={styles.value}>$329.17B</Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>Open Interest</Text>
            <RcIconInfoFillCC
              width={15}
              height={15}
              color={colors2024['neutral-info']}
            />
          </View>
          <View>
            <Text style={styles.value}>$329.17B</Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>Funding</Text>
            <RcIconInfoFillCC
              width={15}
              height={15}
              color={colors2024['neutral-info']}
            />
          </View>
          <View>
            <Text style={styles.value}>0.0010512%</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  section: {
    marginBottom: 30,
  },
  header: {
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  list: {
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  listItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  listItemMain: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 20,
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
}));
