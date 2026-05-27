import { Button } from '@/components2024/Button';
import { Tip } from '@/components/Tip';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ActionsContainer, Props } from './ActionsContainer';
import { GasLessAnimatedWrapper } from './GasLessComponents';
import { BOTTOM_BUTTON_DOUBLE_HEIGHT } from '@/constant/layout';

const getStyles2024 = createGetStyles2024(({ colors2024 }) => ({
  button: {
    height: BOTTOM_BUTTON_DOUBLE_HEIGHT,
    borderRadius: 12,
  },
  buttonText: {
    color: colors2024['neutral-InvertHighlight'],
    fontSize: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
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
  gasLessThemeColor,
  isGasNotEnough,
  buttonIcon,
  isMiniSignTx,
  loading,
}) => {
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle: getStyles2024 });

  const buttonText = submitText ?? t('page.signFooterBar.startSigning');
  const buttonTextStyle = styles.buttonText;
  const buttonStyle = StyleSheet.flatten([
    styles.button,
    !!gasLess && !!gasLessThemeColor
      ? { backgroundColor: gasLessThemeColor, borderColor: gasLessThemeColor }
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
                type="primary"
                height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                buttonStyle={[styles.button, buttonStyle]}
                titleStyle={buttonTextStyle}
                onPress={onSubmit}
                icon={buttonIcon}
                title={buttonText}
                loading={loading}
                showTextOnLoading
              />
            </GasLessAnimatedWrapper>
          </View>
        </Tip>
      </View>
    </ActionsContainer>
  );
};
