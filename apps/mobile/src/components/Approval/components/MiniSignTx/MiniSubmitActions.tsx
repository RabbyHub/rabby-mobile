import { globalBottomSheetModalAddListener } from '@/components/GlobalBottomSheetModal';
import { EVENT_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { Tip } from '@/components/Tip';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { extend } from 'colord';
import mixPlugin from 'colord/plugins/mix';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import {
  ActionsContainer,
  PropsWithAuthSession,
} from '../FooterBar/ActionsContainer';
import { GasLessAnimatedWrapper } from '../FooterBar/GasLessComponents';
import { useSubmitAction } from '../FooterBar/useSubmitAction';
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { Button } from '@/components2024/Button';
import useDebounce from 'react-use/lib/useDebounce';
import { useGetMiniSigningTypedData } from '@/hooks/useMiniApprovalDirectSignTypedData';

extend([mixPlugin]);

export const MiniSubmitActions: React.FC<PropsWithAuthSession> = ({
  USE_LAST_UNLOCKED_AUTH: useLastUnlockedAuth = false,
  disabledProcess,
  onSubmit,
  onCancel,
  tooltipContent,
  enableTooltip,
  gasLess,
  gasLessThemeColor,
  isGasNotEnough,
  isMiniSignTx,
  chain,
  isSwap,
  directSubmit,
  miniSignType = 'tx',
}) => {
  const { t } = useTranslation();
  const [isSign, setIsSign] = React.useState(!gasLess);

  const handleClickSign = React.useCallback(() => {
    setIsSign(true);

    isSwap &&
      preferenceService.setReportActionTs(
        REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_SIGN,
        {
          chain: chain?.serverId as string,
        },
      );
  }, [chain, isSwap]);
  const colors = useThemeColors();
  const { styles } = useTheme2024({ getStyle: getStyles2024 });
  const [pressedConfirm, setPressedConfirm] = React.useState(false);
  const { submitText, SubmitIcon, onPress } = useSubmitAction({
    useLastUnlockedAuth,
  });
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

  const signingTypedData = useGetMiniSigningTypedData();

  useDebounce(
    () => {
      if (signingTypedData && directSubmit && miniSignType === 'typedData') {
        onSubmit();
      }
    },
    300,
    [miniSignType, signingTypedData, handlePress, directSubmit],
  );

  return (
    <ActionsContainer onCancel={onCancel} isMiniSignTx={isMiniSignTx}>
      {isSign ? (
        <View style={styles.warper}>
          <Button
            disabled={disabledProcess || pressedConfirm}
            type="primary"
            onPress={handlePress}
            icon={
              SubmitIcon ? (
                <SubmitIcon
                  width={24}
                  height={24}
                  style={{
                    // @ts-expect-error
                    color: colors['neutral-title-2'],
                  }}
                />
              ) : null
            }
            title={submitText}
          />
        </View>
      ) : (
        <View style={styles.warper}>
          {/* @ts-expect-error */}
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

const getStyles2024 = createGetStyles2024(({ colors2024 }) => ({
  warper: {
    flex: 1,
  },

  button: {
    height: 56,
    // borderColor: colors2024['brand-default'],
    // borderWidth: 1,
  },
  buttonConfirm: {
    width: '100%',
    // borderColor: colors2024['brand-default'],
    // backgroundColor: colors2024['brand-default'],
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
