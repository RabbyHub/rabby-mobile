import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components2024/Button';
import AutoLockView from '@/components/AutoLockView';
import RcIconWarningCircleCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import { HealthFactorBar } from './HealthFactorBar';
import { HF_COLOR_GOOD_THRESHOLD } from '../utils/constant';
import { useTranslation } from 'react-i18next';

export const HFDescription: React.FC<{
  hf: string;
  onClose?: () => void;
}> = ({ hf, onClose }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <Text style={styles.title}>{t('page.Lending.hfTitle')}</Text>
      <View style={styles.contentContainer}>
        <Text style={styles.introText}>
          {t('page.Lending.lqDescription.introText')}
        </Text>

        <View style={styles.rulesContainer}>
          <View style={styles.ruleItem}>
            <View style={styles.grayBullet} />
            <Text style={styles.greyRuleText}>
              <Text style={styles.greenRuleText}>
                {t('page.Lending.lqDescription.over3title')}
              </Text>{' '}
              {t('page.Lending.lqDescription.over3desc')}
            </Text>
          </View>

          <View style={styles.ruleItem}>
            <View style={styles.grayBullet} />
            <Text style={styles.greyRuleText}>
              <Text style={styles.redRuleText}>
                {t('page.Lending.lqDescription.below1title')}
              </Text>{' '}
              {t('page.Lending.lqDescription.below1desc')}
            </Text>
          </View>

          <View style={styles.ruleItem}>
            <View style={styles.grayBullet} />
            <Text style={styles.greyRuleText}>
              {t('page.Lending.lqDescription.liquidation')}
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
            {t('page.Lending.lqDescription.warningText')}
          </Text>
        </View>
      )}

      <Button
        containerStyle={styles.button}
        title={t('page.Lending.gotIt')}
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
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 12,
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
    marginBottom: 20,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  grayBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ctx.colors2024['neutral-secondary'],
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
    marginTop: 20,
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
