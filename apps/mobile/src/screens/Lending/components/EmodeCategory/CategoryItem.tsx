import { Text, View } from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { useTranslation } from 'react-i18next';

export default function CategoryItem({
  title,
  available,
  style,
  isSelected,
  onPress,
}: RNViewProps & {
  title: string;
  available?: boolean;
  isSelected?: boolean;
  onPress?(): void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const isDark = useGetBinaryMode() === 'dark';
  return (
    <TouchableView
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? colors2024['neutral-bg-2']
            : colors2024['neutral-bg-1'],
        },
        isSelected && styles.isSelected,
        style,
      ]}
      onPress={() => {
        onPress?.();
      }}>
      <View style={styles.contentContainer}>
        <View style={styles.leftBasic}>
          <Text style={[styles.nameText, !available && styles.unavailableText]}>
            {title}
          </Text>
        </View>
        <View style={styles.rightArea}>
          <Text style={styles.unavailableTag}>
            {available ? '' : t('page.Lending.manageEmode.unavailable')}
          </Text>
        </View>
      </View>
    </TouchableView>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
    height: 68,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 8,
    borderRadius: 12,
  },
  isSelected: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-light-2'],
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 12,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  leftBasic: {
    flexDirection: 'column',
  },
  nameText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  unavailableText: {
    color: colors2024['neutral-info'],
    fontWeight: '500',
  },
  selectChainItemBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  walletIcon: {
    color: colors2024['neutral-foot'],
    width: 14,
    height: 14,
    marginRight: 6,
  },
  usdValueText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  rightArea: {},
  badgeStyle: {
    top: 0,
    right: 0,
    backgroundColor: colors2024['green-default'],
    borderColor: colors2024['neutral-title-2'],
  },
  chainSummary: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  unavailableTag: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
}));
