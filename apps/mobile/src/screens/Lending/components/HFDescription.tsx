import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components2024/Button';
import AutoLockView from '@/components/AutoLockView';
import RcIconWarningCircleCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import { HealthFactorBar } from './HealthFactorBar';
import { HF_COLOR_GOOD_THRESHOLD } from '../utils/constant';

export const HFDescription: React.FC<{
  hf: string;
  onClose?: () => void;
}> = ({ hf, onClose }) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <Text style={styles.title}>Health Factor</Text>
      <View style={styles.contentContainer}>
        <Text style={styles.introText}>
          Your Health Factor shows how safe your borrowing position is. If it
          drops too low, your collateral could be liquidated.
        </Text>

        <View style={styles.rulesContainer}>
          <View style={styles.ruleItem}>
            <View style={styles.greenBullet} />
            <Text style={styles.greyRuleText}>
              <Text style={styles.greenRuleText}>{'Health factor > 3.0:'}</Text>{' '}
              Your positions are safe
            </Text>
          </View>

          <View style={styles.ruleItem}>
            <View style={styles.greenBullet} />
            <Text style={styles.greyRuleText}>
              <Text style={styles.redRuleText}>Health Factor ≤ 1.0:</Text> Your
              position is at risk of liquidation.
            </Text>
          </View>

          <View style={styles.ruleItem}>
            <View style={styles.greenBullet} />
            <Text style={styles.greyRuleText}>
              Liquidation: If your Health Factor falls below 1.0, part of your
              collateral may be automatically sold to repay the debt. A
              liquidation penalty will apply, resulting in a partial loss of
              your collateral.
            </Text>
          </View>
        </View>

        <HealthFactorBar healthFactor={hf} />
      </View>
      {Number(hf) < HF_COLOR_GOOD_THRESHOLD && (
        <View style={styles.warningContainer}>
          <RcIconWarningCircleCC
            width={16}
            height={16}
            color={colors2024['red-default']}
          />
          <Text style={styles.warningText}>
            Your Health Factor is too low. To avoid liquidation:{'\n'}
            1. Repay part or all of your loan{'\n'}
            2. Add more collateral
          </Text>
        </View>
      )}

      <Button
        containerStyle={styles.button}
        title={'Got it'}
        onPress={onClose}
      />
    </AutoLockView>
  );
};
const getStyles = createGetStyles2024(ctx => ({
  container: {
    paddingHorizontal: 25,
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 0,
    fontFamily: 'SF Pro Rounded',
  },
  contentContainer: {
    width: '100%',
    paddingTop: 8,
  },
  introText: {
    fontSize: 16,
    lineHeight: 18,
    color: ctx.colors2024['neutral-secondary'],
    marginBottom: 20,
    fontFamily: 'SF Pro Rounded',
  },
  rulesContainer: {
    marginBottom: 24,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  greenBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
    marginTop: 9,
    marginRight: 12,
  },
  redBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ctx.colors2024['red-default'],
    marginTop: 9,
    marginRight: 12,
  },
  greyBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ctx.colors2024['neutral-foot'],
    marginTop: 9,
    marginRight: 12,
  },
  greenRuleText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: '#22C55E',
    fontFamily: 'SF Pro Rounded',
  },
  redRuleText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
  greyRuleText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: ctx.colors2024['red-light-1'],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    color: ctx.colors2024['red-default'],
    fontWeight: '500',
    marginLeft: 10,
    fontFamily: 'SF Pro Rounded',
  },
  button: {
    position: 'absolute',
    bottom: 56,
    width: '100%',
  },
}));
