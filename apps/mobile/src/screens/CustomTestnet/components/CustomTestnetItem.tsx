import RcIconRemove from '@/assets/icons/custom-testnet/remove.svg';
import RcIconEdit from '@/assets/icons/custom-testnet/edit.svg';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { Text } from '@/components/Typography';
import type { TestnetChain } from '@/core/services/customTestnetService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

export const CustomTestnetItem = ({
  style,
  containerStyle,
  item,
  onEdit,
  onRemove,
  onPress,
  editable,
  disabled,
}: {
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  item: TestnetChain;
  onEdit?: (item: TestnetChain) => void;
  onRemove?: (item: TestnetChain) => void;
  onPress?: (item: TestnetChain) => void;
  editable?: boolean;
  disabled?: boolean;
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const content = (
    <View
      style={[
        styles.item,
        editable && styles.editableItem,
        disabled && styles.disabled,
        style,
      ]}>
      <TestnetChainLogo name={item.name} size={40} roundedSquare />
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.info} numberOfLines={1}>
            {t('page.customTestnet.currency')}: {item.nativeTokenSymbol}
          </Text>
          <Text style={styles.info} numberOfLines={1}>
            {t('page.customTestnet.id')}:{item.id}
          </Text>
        </View>
      </View>
      {editable && <RcIconEdit color={colors2024['neutral-title-1']} />}
    </View>
  );

  return (
    <View style={[styles.row, containerStyle]}>
      {editable && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('page.customTestnet.removeNetwork', {
            name: item.name,
          })}
          hitSlop={10}
          onPress={() => onRemove?.(item)}>
          <RcIconRemove />
        </TouchableOpacity>
      )}
      {disabled || (!onPress && !editable) ? (
        <View style={styles.card} accessibilityState={{ disabled: !!disabled }}>
          {content}
        </View>
      ) : (
        <TouchableOpacity
          containerStyle={styles.card}
          accessibilityRole="button"
          onPress={() => (editable ? onEdit?.(item) : onPress?.(item))}>
          {content}
        </TouchableOpacity>
      )}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    backgroundColor: colors2024[isLight ? 'neutral-bg-1' : 'neutral-bg-2'],
  },
  item: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: colors2024[isLight ? 'neutral-bg-1' : 'neutral-bg-2'],
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
    alignItems: 'center',
  },
  content: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  editableItem: {
    gap: 12,
  },
  name: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 23,
  },
  info: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    flexShrink: 1,
  },
  disabled: {
    opacity: 0.3,
  },
}));
