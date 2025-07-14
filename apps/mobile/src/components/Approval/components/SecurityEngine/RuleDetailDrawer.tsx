import {
  RuleConfig,
  NumberDefine,
  EnumDefine,
  Level,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { sortBy } from 'lodash';
import SecurityLevel from './SecurityLevel';
import { SecurityEngineLevelOrder } from '@/constant/security';

import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { RcIconNavBack } from '@/components/WebView/icons';

const width = Dimensions.get('window').width;

const getThresholdWrapperStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    thresholdWrapper: {
      borderRadius: 4,
      padding: 18,
      display: 'flex',
      fontWeight: '500',
      fontSize: 15,
      lineHeight: 18,
      marginBottom: 12,
      flexDirection: 'row',
    },
    thresholdDisplay: {
      fontWeight: '700',
      fontSize: 13,
      lineHeight: 18,
      color: colors['neutral-title-1'],
      marginLeft: 8,
    },
    safe: {
      color: '#27c193',
      backgroundColor: 'rgba(39, 193, 147, 0.06)',
    },
    warning: {
      color: '#ffb020',
      backgroundColor: 'rgba(255, 176, 32, 0.06)',
    },
    danger: {
      color: '#ec5151',
      backgroundColor: 'rgba(236, 81, 81, 0.06)',
    },
    forbidden: {
      color: '#af160e',
      backgroundColor: 'rgba(236, 81, 81, 0.06)',
    },
  });

const ThresholdItem = ({ rule, level }: { rule: RuleConfig; level: Level }) => {
  const { t } = useTranslation();
  const displayThreshold = useMemo(() => {
    const threshold = {
      ...rule.defaultThreshold,
      ...rule.customThreshold,
    };
    const value = threshold[level];
    const levelThreshold = threshold[level];
    switch (rule.valueDefine.type) {
      case 'boolean':
        if (value === true) return 'Yes';
        return 'No';
      case 'percent':
      case 'float':
      case 'int': {
        const { max: valueMax, min: valueMin } = rule.valueDefine;
        const { max, min, maxIncluded, minIncluded } =
          levelThreshold as NumberDefine;
        const arr: string[] = [];
        if (min !== null) {
          if (minIncluded) {
            if (min === valueMax) {
              arr.push(min.toString());
            } else {
              arr.push(
                `≥${min}${rule.valueDefine.type === 'percent' ? '%' : ''}`,
              );
            }
          } else {
            arr.push(
              `>${min}${rule.valueDefine.type === 'percent' ? '%' : ''}`,
            );
          }
        }
        if (max !== null) {
          if (maxIncluded) {
            if (max === valueMin) {
              arr.push(max.toString());
            } else {
              arr.push(
                `≤${max}${rule.valueDefine.type === 'percent' ? '%' : ''}`,
              );
            }
          } else {
            arr.push(
              `<${max}${rule.valueDefine.type === 'percent' ? '%' : ''}`,
            );
          }
        } else {
          arr.push('∞');
        }
        return arr.join(' ; ');
      }
      case 'enum':
        return (levelThreshold as string[])
          .map(item => (rule.valueDefine as EnumDefine).display[item])
          .join(' or ');
      default:
        return '';
    }
  }, [rule, level]);
  const colors = useThemeColors();
  const styles = getThresholdWrapperStyles(colors);
  return (
    <View style={StyleSheet.flatten([styles.thresholdWrapper, styles[level]])}>
      <SecurityLevel level={level} />
      <Text>:</Text>
      <Text style={styles.thresholdDisplay}>
        {t('page.securityEngine.whenTheValueIs', { value: displayThreshold })}
      </Text>
    </View>
  );
};

const getRuleDetailDrawerWrapperStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    ruleDetailDrawerWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors['neutral-bg-1'],
      padding: 20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    title: {
      color: colors['neutral-title-1'],
      fontSize: 20,
      lineHeight: 23,
      fontWeight: '500',
      marginVertical: 15,
      flex: 1,
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

const RuleDetailDrawer = ({
  visible,
  rule,
  onCancel,
}: {
  visible: boolean;
  rule: RuleConfig;
  onCancel(): void;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useTranslation();

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(() => {
      onCancel();
    }, 500);
  };

  useEffect(() => {
    setTimeout(() => {
      setIsVisible(visible);
    }, 100);
  }, [visible]);

  const thresholds = useMemo(() => {
    const merged = {
      ...rule.defaultThreshold,
      ...rule.customThreshold,
    };
    return sortBy(Object.keys(merged), key => {
      return SecurityEngineLevelOrder.findIndex(k => k === key);
    }).map(key => {
      return {
        data: merged[key],
        level: key as Level,
      };
    });
  }, [rule]);

  const colors = useThemeColors();
  const styles = getRuleDetailDrawerWrapperStyles(colors);

  const transAnim = React.useRef(new Animated.Value(0));
  const trans = transAnim.current.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  });

  React.useEffect(() => {
    Animated.timing(transAnim.current, {
      toValue: isVisible ? 1 : 0,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  return (
    <Animated.View
      style={StyleSheet.flatten([
        styles.ruleDetailDrawerWrapper,
        {
          transform: [
            {
              translateX: trans,
            },
          ],
        },
      ])}>
      <View style={styles.titleContainer}>
        <TouchableView
          style={{
            width: 100,
          }}
          onPress={handleCancel}>
          <RcIconNavBack width={26} height={26} />
        </TouchableView>
        <Text style={styles.title}>{t('page.securityEngine.viewRules')}</Text>
      </View>
      <View>
        {thresholds.map(threshold => (
          <ThresholdItem
            rule={rule}
            level={threshold.level}
            key={threshold.level}
          />
        ))}
      </View>
    </Animated.View>
  );
};

export default RuleDetailDrawer;
