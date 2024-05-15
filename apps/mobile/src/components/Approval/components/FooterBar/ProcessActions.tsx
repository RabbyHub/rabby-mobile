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
      width: 233,
      height: 48,
      borderColor: colors['blue-default'],
      borderWidth: 1,
      borderRadius: 8,
    },
    buttonText: {
      color: colors['blue-default'],
      fontSize: 16,
      fontWeight: '500',
    },
    disabled: {
      opacity: 0.5,
    },
  });

export const ProcessActions: React.FC<Props> = ({
  onSubmit,
  onCancel,
  disabledProcess,
  tooltipContent,
  submitText,
  gasLess,
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <ActionsContainer onCancel={onCancel}>
      <Tip
        // @ts-expect-error
        content={tooltipContent}>
        <View>
          <GasLessAnimatedWrapper
            title={t('page.signFooterBar.signAndSubmitButton')}
            titleStyle={styles.buttonText}
            buttonStyle={styles.button}
            gasLess={gasLess}
            showOrigin={!gasLess && !disabledProcess}
            type="process">
            <Button
              disabled={disabledProcess}
              type={gasLess ? 'primary' : 'clear'}
              buttonStyle={styles.button}
              titleStyle={
                gasLess
                  ? StyleSheet.flatten([
                      styles.buttonText,
                      { color: colors['neutral-title-2'] },
                    ])
                  : styles.buttonText
              }
              disabledStyle={styles.disabled}
              onPress={onSubmit}
              title={submitText ?? t('page.signFooterBar.beginSigning')}
            />
          </GasLessAnimatedWrapper>
        </View>
      </Tip>
    </ActionsContainer>
  );
};
