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
import { BottomSheetView } from '@gorhom/bottom-sheet';

import { StyleSheet } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { Radio } from '@/components/Radio';
import { Button } from '@/components';
import { Switch } from '@rneui/themed';

const getRuleDrawerWrapperStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      borderRadius: 8,
      padding: 16,
      height: 300,
      position: 'relative',
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
      padding: 12,
      width: '100%',
      height: 40,
      fontWeight: '500',
    },
    buttonIgnoreText: {
      fontSize: 13,
      lineHeight: 15,
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
      backgroundColor: '#f5f6fa',
    },
    proceed: {
      backgroundColor: '#f5f6fa',
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
      paddingHorizontal: 20,
      backgroundColor: colors['neutral-bg-1'],
      height: '100%',
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

  const displayValue = useMemo(() => {
    if (!selectRule) return '';
    const { value, ruleConfig } = selectRule;
    switch (ruleConfig.valueDefine.type) {
      case 'boolean':
        if (value === true) return t('page.securityEngine.yes');
        return t('page.securityEngine.no');
      case 'enum':
        return ruleConfig.valueDefine.display[value as string];
      case 'percent':
        return `${(value as number).toFixed(2)}%`;
      case 'int':
        return Math.floor(value as number);
      case 'float':
        return (value as number).toFixed(2);
      default:
        return value;
    }
  }, [selectRule]);

  const displayThreshold = useMemo(() => {
    if (!selectRule) return '';
    const { level, ruleConfig, value } = selectRule;
    if (!level || !ruleConfig.enable || level === Level.ERROR) return '';
    const threshold = {
      ...ruleConfig.defaultThreshold,
      ...ruleConfig.customThreshold,
    };
    const levelThreshold = threshold[level];
    switch (ruleConfig.valueDefine.type) {
      case 'boolean':
        if (value === true) return 'Yes';
        return 'No';
      case 'float':
      case 'percent':
      case 'int': {
        const { max: valueMax, min: valueMin } = ruleConfig.valueDefine;
        const { max, min, maxIncluded, minIncluded } =
          levelThreshold as NumberDefine;
        const arr: string[] = [];
        if (min !== null) {
          if (minIncluded) {
            if (min === valueMax) {
              arr.push(min.toString());
            } else {
              arr.push(
                `≥${min}${
                  ruleConfig.valueDefine.type === 'percent' ? '%' : ''
                }`,
              );
            }
          } else {
            arr.push(
              `>${min}${ruleConfig.valueDefine.type === 'percent' ? '%' : ''}`,
            );
          }
        }
        if (max !== null) {
          if (maxIncluded) {
            if (max === valueMin) {
              arr.push(max.toString());
            } else {
              arr.push(
                `≤${max}${
                  ruleConfig.valueDefine.type === 'percent' ? '%' : ''
                }`,
              );
            }
          } else {
            arr.push(
              `<${max}${ruleConfig.valueDefine.type === 'percent' ? '%' : ''}`,
            );
          }
        } else {
          arr.push('∞');
        }
        return arr.join(' ; ');
      }
      case 'enum':
        return (levelThreshold as string[])
          .map(item => (ruleConfig.valueDefine as EnumDefine).display[item])
          .join(' or ');
      default:
        return '';
    }
  }, [selectRule]);

  const ruleLevels = useMemo(() => {
    if (!selectRule) return '';
    const { ruleConfig } = selectRule;
    const threshold = {
      ...ruleConfig.defaultThreshold,
      ...ruleConfig.customThreshold,
    };

    return sortBy(Object.keys(threshold), key => {
      return SecurityEngineLevelOrder.findIndex(k => k === key);
    })
      .map(level => SecurityEngineLevel[level]?.text)
      .join('/');
  }, [selectRule]);

  const ignoreButtonDisabled = useMemo(() => {
    if (!selectRule) return true;
    if (selectRule.level === Level.FORBIDDEN) return true;
    if (selectRule.ignored) {
      return !isHovering;
    }
    if (selectRule.level === Level.DANGER && !accepted) return true;
    return false;
  }, [selectRule, accepted, isHovering]);

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
  }, [selectRule, isHovering]);

  const handleIgnore = () => {
    if (!selectRule || selectRule.level === Level.FORBIDDEN) return;
    onIgnore(selectRule.ruleConfig.id);
  };

  const handleUndoIgnore = () => {
    if (!selectRule) return;
    onUndo(selectRule.ruleConfig.id);
  };

  const handleEnableStatusChange = async (value: boolean) => {
    if (!selectRule) return;
    await onRuleEnableStatusChange(selectRule.ruleConfig.id, value);
    setEnabled(value);
    setChanged(true);
    onClose(true);
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
  const colors = useThemeColors();
  const ruleDrawerWrapperStyles = getRuleDrawerWrapperStyles(colors);
  const content = () => {
    if (!selectRule) return null;
    if (!selectRule.ruleConfig.enable) {
      return (
        <View
          style={[
            StyleSheet.flatten([
              ruleDrawerWrapperStyles.container,
              ruleDrawerWrapperStyles.error,
            ]),
          ]}>
          <IconDisable />
          <Text
            style={[
              ruleDrawerWrapperStyles.text,
              // eslint-disable-next-line react-native/no-inline-styles
              {
                marginTop: 4,
              },
            ]}>
            {t('page.securityEngine.ruleDisabled')}
          </Text>
        </View>
      );
    } else if (selectRule.level === Level.ERROR) {
      return (
        <View
          style={StyleSheet.flatten([
            ruleDrawerWrapperStyles.container,
            ruleDrawerWrapperStyles[selectRule.level],
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
      const levelStyles = getLevelStyles(colors, currentLevel);
      return (
        <View
          style={StyleSheet.flatten([
            ruleDrawerWrapperStyles.container,
            selectRule.ignored
              ? ruleDrawerWrapperStyles.proceed
              : selectRule.level && ruleDrawerWrapperStyles[selectRule.level],
          ])}>
          <View style={ruleDrawerWrapperStyles.valueDesc}>
            <Text style={ruleDrawerWrapperStyles.descTitle}>Description:</Text>
            <View className="flex-1 relative">
              <Text> {selectRule.ruleConfig.valueDescription}</Text>
              {valueTooltip ? (
                <Tip content={valueTooltip}>
                  <IconQuestionMark className="inline-block ml-[3px]" />
                </Tip>
              ) : null}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ruleDrawerWrapperStyles.threshold}>
              {t('page.securityEngine.alertTriggerReason')}
            </Text>
            <View
              style={StyleSheet.flatten([
                ruleDrawerWrapperStyles.ruleThreshold,
                levelStyles.ruleThreshold,
              ])}>
              {Icon && <Icon style={ruleDrawerWrapperStyles.levelIcon} />}
              {selectRule.level && (
                <Text
                  style={StyleSheet.flatten([
                    ruleDrawerWrapperStyles.levelText,
                    levelStyles.levelText,
                  ])}>
                  {SecurityEngineLevel[selectRule.level].text}:
                </Text>
              )}
              <View>
                <Text style={ruleDrawerWrapperStyles.thresholdText}>
                  {t('page.securityEngine.whenTheValueIs', {
                    value: displayThreshold,
                  })}
                </Text>
                <Text style={ruleDrawerWrapperStyles.currentValue}>
                  {t('page.securityEngine.currentValueIs', {
                    value: displayThreshold,
                  })}
                </Text>
              </View>
            </View>
            {selectRule.level !== 'safe' && (
              <View style={ruleDrawerWrapperStyles.ruleThresholdFooter}>
                {selectRule.level === Level.DANGER && (
                  <View
                    style={[
                      ruleDrawerWrapperStyles.riskConfirm,
                      // eslint-disable-next-line react-native/no-inline-styles
                      {
                        opacity: selectRule.ignored ? 0.5 : 1,
                      },
                    ]}>
                    <Radio
                      title={t('page.securityEngine.understandRisk')}
                      checked={selectRule.ignored || accepted}
                      onPress={() =>
                        setAccepted(!(selectRule.ignored || accepted))
                      }
                    />
                  </View>
                )}
                {selectRule.level === Level.FORBIDDEN && (
                  <Text style={ruleDrawerWrapperStyles.forbiddenTip}>
                    {t('page.securityEngine.forbiddenCantIgnore')}
                  </Text>
                )}
                <View>
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
                    onPress={
                      selectRule.ignored ? handleUndoIgnore : handleIgnore
                    }
                    disabledStyle={StyleSheet.flatten([
                      {
                        backgroundColor: ignoreButtonContent.color as any,
                      },
                      levelStyles.buttonIgnore,
                    ])}
                    disabledTitleStyle={{
                      color: colors['neutral-title-1'],
                    }}
                    disabled={ignoreButtonDisabled}
                    title={ignoreButtonContent.text}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      );
    }
  };

  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={handleClose}
      snapPoints={['60%']}>
      <BottomSheetView style={styles.mainView}>
        <AppBottomSheetModalTitle
          title={t('page.securityEngine.ruleDetailTitle')}
        />

        {selectRule && (
          <>
            {content()}
            <View style={styles.ruleFooter}>
              <View style={styles.ruleFooterItem}>
                <Text>{t('page.securityEngine.enableRule')}</Text>
                <View style={styles.ruleFooterItemRight}>
                  <Switch
                    value={
                      enabled === null ? selectRule.ruleConfig.enable : enabled
                    }
                    onChange={_ =>
                      handleEnableStatusChange(
                        !(enabled === null
                          ? selectRule.ruleConfig.enable
                          : enabled),
                      )
                    }
                  />
                </View>
              </View>
              <TouchableOpacity
                style={styles.ruleFooterItem}
                onPress={() => setRuleDetailDrawerVisible(true)}>
                <Text>{t('page.securityEngine.viewRiskLevel')}</Text>
                <View style={styles.ruleFooterItemRight}>
                  <Text>{ruleLevels}</Text>
                  <RcIconArrowRight style={styles.iconRight} />
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
        {selectRule && (
          <RuleDetailDrawer
            visible={ruleDetailDrawerVisible}
            rule={selectRule.ruleConfig}
            onCancel={() => setRuleDetailDrawerVisible(false)}
          />
        )}
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

export default RuleDrawer;
