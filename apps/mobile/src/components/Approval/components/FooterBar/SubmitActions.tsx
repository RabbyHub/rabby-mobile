import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionsContainer, Props } from './ActionsContainer';
import { StyleSheet, View, Text } from 'react-native';
import { Button } from '@/components/Button';
import { Tip } from '@/components/Tip';
import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { GasLessAnimatedWrapper } from './GasLessComponents';
import { colord, extend } from 'colord';
import mixPlugin from 'colord/plugins/mix';
import { useSubmitAction } from './useSubmitAction';
import { globalBottomSheetModalAddListener } from '@/components/GlobalBottomSheetModal';
import { EVENT_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { createGetStyles2024 } from '@/utils/styles';

extend([mixPlugin]);

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    button: {
      height: 48,
      borderColor: colors['blue-default'],
      borderWidth: 1,
      borderRadius: 8,
    },
    buttonConfirm: {
      width: 240,
      borderColor: colors['blue-default'],
      backgroundColor: colors['blue-default'],
      // borderColor: colord(colors['blue-default'])
      //   .mix(colord(colors['neutral-black']), 0.2)
      //   .toHex(),
      // backgroundColor: colord(colors['blue-default'])
      //   .mix(colord(colors['neutral-black']), 0.2)
      //   .toHex(),
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

const getStyles2024 = createGetStyles2024(({ colors2024 }) => ({
  button: {
    height: 56,
    borderColor: colors2024['brand-default'],
    borderWidth: 1,
    borderRadius: 100,
  },
  buttonConfirm: {
    width: 220,
    borderColor: colors2024['brand-default'],
    backgroundColor: colors2024['brand-default'],
  },
  buttonText: {
    color: colors2024['neutral-InvertHighlight'],
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
  buttonDisabled: {
    borderColor: 'transparent', //colors2024['brand-default'],
  },
  buttonWrapper: {},
  submitButtonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
}));

export const SubmitActions: React.FC<Props> = ({
  disabledProcess,
  onSubmit,
  onCancel,
  tooltipContent,
  enableTooltip,
  gasLess,
  gasLessThemeColor,
  isGasNotEnough,
  isMiniSignTx,
}) => {
  const { t } = useTranslation();
  const [isSign, setIsSign] = React.useState(false);

  const handleClickSign = React.useCallback(() => {
    setIsSign(true);
  }, []);
  const colors = useThemeColors();
  const oldStyles = React.useMemo(() => getStyles(colors), [colors]);

  const { styles: styles2024 } = useTheme2024({ getStyle: getStyles2024 });

  const styles = useMemo(
    () => (isMiniSignTx ? styles2024 : oldStyles),
    [isMiniSignTx, styles2024, oldStyles],
  );
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
    <ActionsContainer onCancel={onCancel} isMiniSignTx={isMiniSignTx}>
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
        <View>
          {/* @ts-ignore */}
          <Tip content={enableTooltip ? tooltipContent : undefined}>
            <View style={styles.buttonWrapper}>
              <GasLessAnimatedWrapper
                isGasNotEnough={isGasNotEnough}
                gasLessThemeColor={gasLessThemeColor}
                title={t('page.signFooterBar.signAndSubmitButton')}
                titleStyle={styles.buttonText}
                buttonStyle={styles.button}
                gasLess={gasLess}
                showOrigin={!gasLess}>
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
        </View>
      )}
    </ActionsContainer>
  );
};
