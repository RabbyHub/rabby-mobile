import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActionsContainer, Props } from './ActionsContainer';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Tip } from '@/components/Tip';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { GasLessAnimatedWrapper } from './GasLessComponents';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    button: {
      width: '100%',
      height: 48,
      borderColor: colors['blue-default'],
      borderWidth: 1,
      borderRadius: 8,
    },
    buttonText: {
      color: colors['neutral-title-2'],
      fontSize: 16,
      fontWeight: '500',
    },
    buttonDisabled: {
      borderColor: colors['blue-light-1'],
    },
    buttonWrapper: {
      marginRight: 10,
    },
  });

export const SubmitActions: React.FC<Props> = ({
  disabledProcess,
  onSubmit,
  onCancel,
  tooltipContent,
  enableTooltip,
  gasLess,
}) => {
  const { t } = useTranslation();
  const [isSign, setIsSign] = React.useState(false);

  const handleClickSign = React.useCallback(() => {
    setIsSign(true);
  }, []);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <ActionsContainer onCancel={onCancel}>
      {isSign ? null : (
        // @ts-expect-error
        <Tip content={enableTooltip ? tooltipContent : undefined}>
          <View style={styles.buttonWrapper}>
            <GasLessAnimatedWrapper
              title={t('page.signFooterBar.signAndSubmitButton')}
              titleStyle={styles.buttonText}
              buttonStyle={styles.button}
              gasLess={gasLess}
              showOrigin={!gasLess && !disabledProcess}>
              <Button
                disabled={disabledProcess}
                type="primary"
                buttonStyle={styles.button}
                titleStyle={styles.buttonText}
                disabledStyle={styles.buttonDisabled}
                onPress={handleClickSign}
                title={t('page.signFooterBar.signAndSubmitButton')}
              />
            </GasLessAnimatedWrapper>
          </View>
        </Tip>
      )}
    </ActionsContainer>
  );
};
