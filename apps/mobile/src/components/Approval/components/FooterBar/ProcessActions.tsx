import React from 'react';
import { ActionsContainer, Props } from './ActionsContainer';
import { useTranslation } from 'react-i18next';
import { Tip } from '@/components/Tip';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

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
          <Button
            disabled={disabledProcess}
            type="clear"
            buttonStyle={styles.button}
            titleStyle={styles.buttonText}
            disabledStyle={styles.disabled}
            onPress={onSubmit}
            title={t('page.signFooterBar.beginSigning')}
          />
        </View>
      </Tip>
    </ActionsContainer>
  );
};
