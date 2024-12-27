import React, { useMemo } from 'react';
import { ActionsContainer, Props } from './ActionsContainer';
import { useTranslation } from 'react-i18next';
import { Tip } from '@/components/Tip';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { GasLessAnimatedWrapper } from './GasLessComponents';
import { createGetStyles2024 } from '@/utils/styles';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    button: {
      height: 48,
      borderColor: colors['blue-default'],
      borderWidth: 1,
      borderRadius: 8,
    },
    buttonText: {
      color: colors['blue-default'],
      fontSize: 15,
      fontWeight: '500',
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
  });

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

export const ProcessActions: React.FC<Props> = ({
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
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const oldStyles = React.useMemo(() => getStyles(colors), [colors]);

  const { styles: styles2024 } = useTheme2024({ getStyle: getStyles2024 });

  const styles = useMemo(
    () => (isMiniSignTx ? styles2024 : oldStyles),
    [isMiniSignTx, styles2024, oldStyles],
  );

  const buttonIsPrimary = isPrimary || gasLess;
  const buttonText = submitText ?? t('page.signFooterBar.beginSigning');
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
              showOrigin={!gasLess && !disabledProcess}
              icon={buttonIcon}
              type="process">
              <Button
                disabled={disabledProcess}
                type={buttonIsPrimary ? 'primary' : 'clear'}
                buttonStyle={[styles.button, buttonStyle]}
                titleStyle={buttonTextStyle}
                disabledStyle={styles.disabled}
                onPress={onSubmit}
                icon={buttonIcon}
                title={buttonText}
                showTitleOnLoading
              />
            </GasLessAnimatedWrapper>
          </View>
        </Tip>
      </View>
    </ActionsContainer>
  );
};
