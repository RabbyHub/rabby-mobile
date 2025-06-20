import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RuleConfig,
  Level,
  NumberDefine,
  EnumDefine,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import { sortBy } from 'lodash';
import RuleDetailDrawer from './RuleDetailDrawer';
import RcIconArrowRight from '@/assets/icons/approval/arrow-right.svg';
import IconError from '@/assets/icons/security-engine/error-big.svg';
import IconDisable from '@/assets/icons/security-engine/disable-big.svg';
import IconQuestionMark from '@/assets/icons/approval/question-mark.svg';
import {
  SecurityEngineLevelOrder,
  SecurityEngineLevel,
} from '@/constant/security';
import { Tip } from '@/components/Tip';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { StyleSheet } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { Radio } from '@/components/Radio';
import { Button } from '@/components';
import { Switch } from '@rneui/themed';
import { ScreenLayouts } from '@/constant/layout';
import { Divide } from '../Actions/components/Divide';

const getRuleDrawerWrapperStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 20,
      position: 'relative',
      marginHorizontal: 20,
      marginBottom: 20,
    },
    text: {
      fontSize: 15,
      color: colors['neutral-title-1'],
      textAlign: 'center',
      fontWeight: '500',
    },
    valueDesc: {
      fontWeight: '500',
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title-1'],
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors['neutral-line'],
      marginBottom: 14,
      display: 'flex',
      flexDirection: 'row',
    },
    descTitle: {
      fontSize: 13,
      lineHeight: 15,
      color: colors['neutral-body'],
      marginRight: 6,
      fontWeight: 'normal',
      marginTop: 1,
    },
    threshold: {
      fontSize: 13,
      lineHeight: 18,
      color: colors['neutral-body'],
    },
    thresholdText: {
      fontWeight: '500',
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title-1'],
    },
    currentValue: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-foot'],
    },
    ruleThreshold: {
      display: 'flex',
      marginTop: 8,
      borderRadius: 4,
      padding: 18,
      flexDirection: 'row',
    },
    levelIcon: {
      width: 16,
      height: 16,
      marginRight: 4,
    },
    levelText: {
      fontWeight: '500',
      fontSize: 15,
      lineHeight: 18,
      marginRight: 8,
    },
    ruleThresholdFooter: {
      width: '100%',
      flex: 1,
      justifyContent: 'flex-end',
    },
    riskConfirm: {
      display: 'flex',
      justifyContent: 'center',
      fontSize: 12,
      lineHeight: 14,
      color: '#707280',
      marginBottom: 12,
      flexDirection: 'row',
    },
    forbiddenTip: {
      marginBottom: 12,
      fontSize: 12,
      lineHeight: 14,
      textAlign: 'center',
      color: '#13141a',
    },
    buttonIgnore: {
      padding: 13,
      fontWeight: '500',
      borderRadius: 6,
    },
    buttonIgnoreText: {
      fontSize: 15,
      lineHeight: 18,
      textAlign: 'center',
      color: '#ffffff',
    },
    safe: {
      backgroundColor: 'rgba(0, 192, 135, 0.06)',
    },
    warning: {
      backgroundColor: 'rgba(255, 176, 32, 0.06)',
    },
    danger: {
      backgroundColor: 'rgba(236, 81, 81, 0.06)',
    },
    forbidden: {
      backgroundColor: 'rgba(175, 22, 14, 0.06)',
    },
    error: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors['neutral-card-2'],
    },
    proceed: {
      backgroundColor: colors['neutral-card-2'],
    },
  });

const safeStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    ruleThreshold: {
      backgroundColor: 'rgba(39, 193, 147, 0.06)',
    },
    levelText: {
      color: '#27c193',
    },
    buttonIgnore: {},
  });

const warningStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    ruleThreshold: {
      backgroundColor: 'rgba(255, 176, 32, 0.06)',
    },
    levelText: {
      color: '#ffb020',
    },
    buttonIgnore: {
      backgroundColor: '#ffb020',
      borderColor: '#ffb020',
    },
  });

const dangerStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    ruleThreshold: {
      backgroundColor: 'rgba(236, 81, 81, 0.06)',
    },
    levelText: {
      color: '#ec5151',
    },
    buttonIgnore: {
      backgroundColor: '#ec5151',
      borderColor: '#ec5151',
    },
  });

const forbiddenStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    ruleThreshold: {
      backgroundColor: 'rgba(236, 81, 81, 0.06)',
    },
    levelText: {
      color: '#af160e',
    },
    buttonIgnore: {
      backgroundColor: '#af160e',
      borderColor: '#af160e',
    },
  });

const errorStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    ruleThreshold: {},
    levelText: {},
    buttonIgnore: {},
  });

const proceedStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    ruleThreshold: {
      backgroundColor: colors['neutral-card-3'],
    },
    levelText: {
      color: colors['neutral-foot'],
    },
    buttonIgnore: {
      backgroundColor: '#707280',
      borderColor: 'transparent',
    },
  });

const getLevelStyles = (
  colors: AppColorsVariants,
  level?: Level | 'proceed',
) => {
  switch (level) {
    case Level.SAFE:
      return safeStyles(colors);
    case Level.WARNING:
      return warningStyles(colors);
    case Level.DANGER:
      return dangerStyles(colors);
    case Level.FORBIDDEN:
      return forbiddenStyles(colors);
    case Level.ERROR:
      return errorStyles(colors);
    case 'proceed':
      return proceedStyles(colors);
    default:
      return { ruleThreshold: {}, levelText: {}, buttonIgnore: {} };
  }
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    mainView: {
      backgroundColor: colors['neutral-bg-1'],
    },
    ruleFooter: {
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 6,
      overflow: 'hidden',
    },
    ruleFooterItem: {
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 15,
      fontWeight: '500',
      fontSize: 13,
      lineHeight: 15,
      color: colors['neutral-title-1'],
      flexDirection: 'row',
    },

    ruleFooterItemRight: {
      fontSize: 12,
      lineHeight: 14,
      textAlign: 'right',
      color: colors['neutral-body'],
      fontWeight: 'normal',
      alignItems: 'center',
      flexDirection: 'row',
    },
    iconRight: {
      width: 16,
      height: 16,
      marginLeft: 4,
    },
    placeholder: {
      height: 30,
    },
    description: {
      color: colors['neutral-title-1'],
      fontSize: 13,
      fontWeight: '500',
      marginTop: 6,
      textAlign: 'center',
    },
    footer: {
      marginBottom: 20,
    },
  });

interface Props {
  selectRule: {
    ruleConfig: RuleConfig;
    value?: number | string | boolean;
    level?: Level;
    ignored: boolean;
  } | null;
  visible: boolean;
  onRuleEnableStatusChange(id: string, value: boolean): Promise<void>;
  onIgnore(id: string): void;
  onUndo(id: string): void;
  onClose(update: boolean): void;
}

const RuleDrawer = ({
  visible,
  selectRule,
  onClose,
  onIgnore,
  onUndo,
  onRuleEnableStatusChange,
}: Props) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [accepted, setAccepted] = useState(false);
  const [changed, setChanged] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [ruleDetailDrawerVisible, setRuleDetailDrawerVisible] = useState(false);
  const { t } = useTranslation();
  // don't have hover event in mobile
  const isHovering = false;
  const currentLevel = useMemo(() => {
    if (!selectRule || selectRule.ignored) return 'proceed';
    return selectRule.level;
  }, [selectRule]);

  const ignoreButtonContent = useMemo(() => {
    if (!selectRule) return { color: null, text: '' };
    let text = '';
    let color: string | null = '#B4BDCC';
    if (selectRule.ignored) {
      if (isHovering) {
        text = t('page.securityEngine.undo');
        color = '#707280';
      } else {
        text = t('page.securityEngine.riskProcessed');
      }
    } else {
      text = t('page.securityEngine.ignoreAlert');
      color = null;
    }
    return {
      text,
      color,
    };
  }, [selectRule, isHovering, t]);

  const handleIgnore = () => {
    if (!selectRule) return;
    onIgnore(selectRule.ruleConfig.id);
  };

  const handleUndoIgnore = () => {
    if (!selectRule) return;
    onUndo(selectRule.ruleConfig.id);
  };

  const handleClose = () => {
    onClose(changed);
  };

  const reset = () => {
    setAccepted(false);
    setChanged(false);
    setEnabled(null);
    setRuleDetailDrawerVisible(false);
  };

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
      reset();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);
  const currentDescription = useMemo(() => {
    if (!selectRule) return '';
    const { ruleConfig, level } = selectRule;
    if (!level) return ruleConfig.valueDescription;
    return ruleConfig.descriptions?.[level] || ruleConfig.valueDescription;
  }, [selectRule]);
  const colors = useThemeColors();
  const levelStyles = getLevelStyles(colors, currentLevel);
  const ruleDrawerWrapperStyles = getRuleDrawerWrapperStyles(colors);
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const content = () => {
    if (!selectRule) return null;
    if (selectRule.level === Level.ERROR) {
      return (
        <View
          style={StyleSheet.flatten([
            ruleDrawerWrapperStyles.container,
            ruleDrawerWrapperStyles[selectRule.level],
            { marginBottom: 30 },
          ])}>
          <IconError />
          <Text
            style={[
              ruleDrawerWrapperStyles.text,
              // eslint-disable-next-line react-native/no-inline-styles
              {
                marginTop: 16,
              },
            ]}>
            {t('page.securityEngine.unknownResult')}
          </Text>
        </View>
      );
    } else {
      const valueTooltip = selectRule.ruleConfig.valueTooltip;
      const Icon = currentLevel && SecurityEngineLevel[currentLevel].icon;
      return (
        <View
          style={StyleSheet.flatten([
            ruleDrawerWrapperStyles.container,
            selectRule.ignored
              ? ruleDrawerWrapperStyles.proceed
              : selectRule.level && ruleDrawerWrapperStyles[selectRule.level],
          ])}>
          {currentLevel && (
            <View
              style={StyleSheet.flatten({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              })}>
              {Icon && <Icon style={ruleDrawerWrapperStyles.levelIcon} />}
              {selectRule.level && (
                <Text
                  style={StyleSheet.flatten({
                    ...levelStyles.levelText,
                    fontWeight: '500',
                  })}>
                  {SecurityEngineLevel[selectRule.level].text}
                </Text>
              )}
            </View>
          )}

          <View className="relative">
            <Text style={styles.description}>{currentDescription}</Text>
            {valueTooltip ? (
              <Tip content={valueTooltip}>
                <IconQuestionMark
                  style={StyleSheet.flatten({ marginLeft: 3 })}
                />
              </Tip>
            ) : null}
          </View>
        </View>
      );
    }
  };

  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={handleClose}
      enableDynamicSizing>
      <BottomSheetScrollView style={styles.mainView}>
        <AppBottomSheetModalTitle
          title={t('page.securityEngine.ruleDetailTitle')}
        />

        {selectRule && content()}

        {selectRule &&
          selectRule.level !== 'safe' &&
          selectRule.level !== 'error' && (
            <View style={styles.footer}>
              <Divide
                style={{
                  marginBottom: 20,
                }}
              />
              <View style={{ marginHorizontal: 20 }}>
                <Button
                  type="primary"
                  buttonStyle={StyleSheet.flatten([
                    {
                      backgroundColor: ignoreButtonContent.color as any,
                    },
                    ruleDrawerWrapperStyles.buttonIgnore,
                    levelStyles.buttonIgnore,
                  ])}
                  titleStyle={ruleDrawerWrapperStyles.buttonIgnoreText}
                  onPress={selectRule.ignored ? handleUndoIgnore : handleIgnore}
                  disabledStyle={StyleSheet.flatten([
                    {
                      backgroundColor: ignoreButtonContent.color as any,
                    },
                    levelStyles.buttonIgnore,
                  ])}
                  disabledTitleStyle={{
                    color: colors['neutral-title-1'],
                  }}
                  title={ignoreButtonContent.text}
                />
              </View>
            </View>
          )}
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

export default RuleDrawer;
