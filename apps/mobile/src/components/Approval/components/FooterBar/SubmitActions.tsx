import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActionsContainer, Props } from './ActionsContainer';
import { StyleSheet, View, Text } from 'react-native';
import { Button } from '@/components/Button';
import { Tip } from '@/components/Tip';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { GasLessAnimatedWrapper } from './GasLessComponents';
import { colord, extend } from 'colord';
import mixPlugin from 'colord/plugins/mix';
import { useSubmitAction } from './useSubmitAction';
import { globalBottomSheetModalAddListener } from '@/components/GlobalBottomSheetModal';
import { EVENT_NAMES } from '@/components/GlobalBottomSheetModal/types';

extend([mixPlugin]);

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    button: {
      width: 240,
      height: 48,
      borderColor: colors['blue-default'],
      borderWidth: 1,
      borderRadius: 8,
    },
    buttonConfirm: {
      borderColor: colord(colors['blue-default'])
        .mix(colord(colors['neutral-black']), 0.2)
        .toHex(),
      backgroundColor: colord(colors['blue-default'])
        .mix(colord(colors['neutral-black']), 0.2)
        .toHex(),
    },
    buttonText: {
      color: colors['neutral-title-2'],
      fontSize: 15,
      fontWeight: '500',
    },
    buttonDisabled: {
      borderColor: colors['blue-light-1'],
    },
    buttonWrapper: {},
    submitButtonWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
  });

export const SubmitActions: React.FC<Props> = ({
  disabledProcess,
  onSubmit,
  onCancel,
  tooltipContent,
  enableTooltip,
  gasLess,
  gasLessThemeColor,
  isGasNotEnough,
}) => {
  const { t } = useTranslation();
  const [isSign, setIsSign] = React.useState(false);

  const handleClickSign = React.useCallback(() => {
    setIsSign(true);
  }, []);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [pressedConfirm, setPressedConfirm] = React.useState(false);
  const { submitText, SubmitIcon, onPress } = useSubmitAction();
  const handlePress = React.useCallback(() => {
    setPressedConfirm(true);
    globalBottomSheetModalAddListener(
      EVENT_NAMES.DISMISS,
      () => {
        setPressedConfirm(false);
      },
      true,
    );
    onPress(onSubmit, () => setPressedConfirm(false));
  }, [onSubmit, setPressedConfirm, onPress]);

  return (
    <ActionsContainer onCancel={onCancel}>
      {isSign ? (
        <Button
          disabled={disabledProcess || pressedConfirm}
          type="primary"
          buttonStyle={StyleSheet.flatten([
            styles.button,
            styles.buttonConfirm,
          ])}
          titleStyle={styles.buttonText}
          disabledStyle={styles.buttonDisabled}
          onPress={handlePress}
          title={
            <View style={styles.submitButtonWrapper}>
              {SubmitIcon && (
                <SubmitIcon
                  width={18}
                  height={18}
                  style={{
                    // @ts-expect-error
                    color: colors['neutral-title-2'],
                  }}
                />
              )}
              <Text style={styles.buttonText}>{submitText}</Text>
            </View>
          }
        />
      ) : (
        // @ts-expect-error
        <Tip content={enableTooltip ? tooltipContent : undefined}>
          <View style={styles.buttonWrapper}>
            <GasLessAnimatedWrapper
              isGasNotEnough={isGasNotEnough}
              gasLessThemeColor={gasLessThemeColor}
              title={t('page.signFooterBar.signAndSubmitButton')}
              titleStyle={styles.buttonText}
              buttonStyle={styles.button}
              gasLess={gasLess}
              showOrigin={!gasLess && !disabledProcess}>
              <Button
                disabled={disabledProcess}
                type="primary"
                buttonStyle={[
                  styles.button,
                  gasLess && gasLessThemeColor
                    ? {
                        backgroundColor: gasLessThemeColor,
                        borderColor: gasLessThemeColor,
                      }
                    : {},
                ]}
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
