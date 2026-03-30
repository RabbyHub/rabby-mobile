import { Button, ButtonProps } from '@/components2024/Button';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { ReactElement } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { GasAccountBenefitsCard } from './GasAccountBenefitsCard';
import { GasAccountWarning } from './GasAccountWarning';

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

  return (
    <View style={[styles.container, style]}>
      <GasAccountWarning style={styles.warning} message={warningMessage} />
      <GasAccountBenefitsCard style={styles.card} />
      <Button
        type={primaryType || 'primary'}
        onPress={onPrimaryPress}
        loading={primaryLoading}
        containerStyle={[styles.primaryButton, primaryContainerStyle]}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
  },
  warning: {
    marginHorizontal: 0,
  },
  card: {
    marginHorizontal: 0,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    marginTop: 'auto',
    marginBottom: 36,
  },
  primaryButtonText: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
}));
