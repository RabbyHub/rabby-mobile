import React from 'react';
import { ActionsContainer, Props } from './ActionsContainer';
import { useTranslation } from 'react-i18next';
import { Tip } from '@/components/Tip';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { GasLessAnimatedWrapper } from './GasLessComponents';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    button: {
      width: 240,
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
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

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
    <ActionsContainer onCancel={onCancel}>
      <View>
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
