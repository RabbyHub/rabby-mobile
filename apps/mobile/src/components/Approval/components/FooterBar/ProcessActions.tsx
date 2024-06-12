import React from 'react';
import { ActionsContainer, Props } from './ActionsContainer';
import { useTranslation } from 'react-i18next';
import { Tip } from '@/components/Tip';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { GasLessAnimatedWrapper } from './GasLessComponents';
import { HoldingAnimated } from './HoldingAnimated';
import { Spin } from '@/screens/TransactionRecord/components/Spin';
import { RcIconSelectCC } from '@/assets/icons/common';

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
  needHolding,
  isPrimary,
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [buttonWidth, setButtonWidth] = React.useState(0);
  const [buttonHeight, setButtonHeight] = React.useState(0);
  const [holdPercent, setHoldPercent] = React.useState(0);

  const getButtonWidthLayout = React.useCallback((e: LayoutChangeEvent) => {
    setButtonWidth(e.nativeEvent.layout.width);
    setButtonHeight(e.nativeEvent.layout.height);
  }, []);
  const buttonIsPrimary = isPrimary || gasLess;
  const buttonText = submitText ?? t('page.signFooterBar.beginSigning');
  return (
    <ActionsContainer onCancel={onCancel}>
      <Tip
        // @ts-expect-error
        content={tooltipContent}>
        <View onLayout={getButtonWidthLayout}>
          <GasLessAnimatedWrapper
            title={t('page.signFooterBar.signAndSubmitButton')}
            titleStyle={styles.buttonText}
            buttonStyle={styles.button}
            gasLess={gasLess}
            showOrigin={!gasLess && !disabledProcess}
            type="process">
            <HoldingAnimated
              width={buttonWidth}
              height={buttonHeight}
              enable={needHolding}
              onChange={setHoldPercent}
              onFinish={onSubmit}>
              <Button
                TouchableComponent={needHolding ? View : undefined}
                disabled={disabledProcess}
                type={buttonIsPrimary ? 'primary' : 'clear'}
                buttonStyle={styles.button}
                titleStyle={
                  buttonIsPrimary
                    ? StyleSheet.flatten([
                        styles.buttonText,
                        { color: colors['neutral-title-2'] },
                      ])
                    : styles.buttonText
                }
                disabledStyle={styles.disabled}
                onPress={needHolding ? undefined : onSubmit}
                title={
                  needHolding ? (
                    <View style={styles.holdButton}>
                      {holdPercent > 0 && holdPercent < 1 ? (
                        <Spin
                          style={styles.spin}
                          color={
                            buttonIsPrimary
                              ? colors['neutral-title-2']
                              : styles.buttonText.color
                          }
                        />
                      ) : null}
                      {holdPercent >= 1 ? (
                        <RcIconSelectCC
                          width={16}
                          height={16}
                          color={
                            buttonIsPrimary
                              ? colors['neutral-title-2']
                              : styles.buttonText.color
                          }
                        />
                      ) : null}
                      <Text
                        style={
                          buttonIsPrimary
                            ? StyleSheet.flatten([
                                styles.buttonText,
                                { color: colors['neutral-title-2'] },
                              ])
                            : styles.buttonText
                        }>
                        {buttonText}
                      </Text>
                    </View>
                  ) : (
                    buttonText
                  )
                }
                showTitleOnLoading
              />
            </HoldingAnimated>
          </GasLessAnimatedWrapper>
        </View>
      </Tip>
    </ActionsContainer>
  );
};
