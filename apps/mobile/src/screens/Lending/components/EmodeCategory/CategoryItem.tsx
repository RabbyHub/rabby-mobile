import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Tip } from '@/components/Tip';
import { createGetStyles2024 } from '@/utils/styles';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { formatPercent } from '@/screens/TokenDetail/util';
import { Text } from '@/components/Typography';

export default function CategoryItem({
  title,
  available,
  ltv,
  style,
  isSelected,
  onPress,
}: RNViewProps & {
  title: string;
  available?: boolean;
  isSelected?: boolean;
  ltv?: string;
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
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.nameText, !available && styles.unavailableText]}>
            {title}
          </Text>
        </View>
        {!available ? (
          <Tip content={t('page.Lending.manageEmode.unavailableTips')}>
            <View style={styles.rightArea}>
              <Text style={styles.unavailableTag}>
                {t('page.Lending.manageEmode.unavailable')}
              </Text>
            </View>
          </Tip>
        ) : (
          <Text style={styles.ltvText}>
            {formatPercent(Number(ltv || 0) / 10000)}
          </Text>
        )}
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
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  leftBasic: {
    flexDirection: 'column',
    flex: 1,
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
  rightArea: {},
  unavailableTag: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  ltvText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
}));
