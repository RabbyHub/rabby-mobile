import { Button, ButtonProps } from '@/components2024/Button';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { ReactElement } from 'react';
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { GasAccountBenefitsCard } from './GasAccountBenefitsCard';
import { GasAccountWarning } from './GasAccountWarning';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const GasAccountEmptyState: React.FC<{
  style?: StyleProp<ViewStyle>;
  onPrimaryPress?(): void;
  primaryTitle?: string;
  primaryContent?: ReactElement;
  primaryType?: ButtonProps['type'];
  primaryLoading?: boolean;
  primaryContainerStyle?: StyleProp<ViewStyle>;
  warningMessage?: string;
}> = ({
  style,
  onPrimaryPress,
  primaryTitle,
  primaryContent,
  primaryType,
  primaryLoading,
  primaryContainerStyle,
  warningMessage,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <GasAccountWarning style={styles.warning} message={warningMessage} />
        <GasAccountBenefitsCard style={styles.card} />
      </ScrollView>
      <Button
        type={primaryType || 'primary'}
        onPress={onPrimaryPress}
        loading={primaryLoading}
        containerStyle={[
          styles.primaryButton,
          { marginBottom: Math.max(bottom, 48) },
          primaryContainerStyle,
        ]}
        title={
          primaryContent || (
            <Text style={styles.primaryButtonText}>
              {primaryTitle || 'Deposit Now'}
            </Text>
          )
        }
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
  },
  contentScroll: {
    flex: 1,
    minHeight: 0,
  },
  contentContainer: {
    flexGrow: 1,
    gap: 12,
    paddingBottom: 12,
  },
  warning: {
    marginHorizontal: 0,
  },
  card: {
    marginHorizontal: 0,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: 'pink',
  },
  primaryButtonText: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
}));
