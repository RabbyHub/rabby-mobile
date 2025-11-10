import { Tip } from '@/components/Tip';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ActionsContainer, Props } from '../FooterBar/ActionsContainer';
import { GasLessAnimatedWrapper } from '../FooterBar/GasLessComponents';
import { Button } from '@/components2024/Button';
import { useGetMiniSigningTypedData } from '@/hooks/useMiniApprovalDirectSignTypedData';
import useDebounce from 'react-use/lib/useDebounce';

const getStyles2024 = createGetStyles2024(({ colors2024 }) => ({
  button: {
    height: 56,
    borderColor: colors2024['brand-default'],
    borderWidth: 1,
    borderRadius: 100,
  },
  buttonText: {
    // color: colors2024['neutral-InvertHighlight'],
    color: colors2024['brand-default'],
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  holdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spin: {
    width: 16,
    height: 16,
  },
}));

export const MiniProcessActions: React.FC<Props> = ({
  onSubmit,
  onCancel,
  disabledProcess,
  tooltipContent,
  submitText,
  gasLess,
  isPrimary,
  gasLessThemeColor,
  isGasNotEnough,
  buttonIcon,
  isMiniSignTx,
  directSubmit,
  miniSignType,
  loading,
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const { styles } = useTheme2024({ getStyle: getStyles2024 });

  const buttonIsPrimary = isPrimary || gasLess;
  const buttonText = submitText ?? t('page.signFooterBar.startSigning');
  const buttonTextStyle = StyleSheet.flatten([
    styles.buttonText,
    buttonIsPrimary ? { color: colors['neutral-title-2'] } : {},
  ]);
  const buttonStyle = StyleSheet.flatten([
    styles.button,
    buttonIsPrimary
      ? !!gasLess && !!gasLessThemeColor
        ? { backgroundColor: gasLessThemeColor, borderColor: gasLessThemeColor }
        : {
            backgroundColor: colors['blue-default'],
          }
      : {},
  ]);

  const signingTypedData = useGetMiniSigningTypedData();
  useDebounce(
    () => {
      if (signingTypedData && directSubmit && miniSignType === 'typedData') {
        onSubmit();
      }
    },
    300,
    [signingTypedData, disabledProcess, directSubmit, miniSignType],
  );

  return (
    <ActionsContainer onCancel={onCancel} isMiniSignTx={isMiniSignTx}>
      <View style={{ flex: 1 }}>
        <Tip
          // @ts-expect-error
          content={tooltipContent}>
          <View>
            <GasLessAnimatedWrapper
              isGasNotEnough={isGasNotEnough}
              gasLessThemeColor={gasLessThemeColor}
              title={buttonText}
              titleStyle={buttonTextStyle}
              buttonStyle={buttonStyle}
              gasLess={gasLess}
              showOrigin={!gasLess}
              icon={buttonIcon}
              type="process">
              <Button
                disabled={disabledProcess}
                type={buttonIsPrimary ? 'primary' : undefined}
                onPress={onSubmit}
                icon={buttonIcon}
                title={buttonText}
                loading={loading}
              />
            </GasLessAnimatedWrapper>
          </View>
        </Tip>
      </View>
    </ActionsContainer>
  );
};
