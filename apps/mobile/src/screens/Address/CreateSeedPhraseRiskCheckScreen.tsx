import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { CheckboxItem } from './components/CheckboxItem';
import { navigateDeprecated } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { RcIconInfoCC } from '@/assets/icons/common';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    tipsWarper: {
      marginTop: 40,
      marginBottom: 24,
    },
    tips: {
      color: colors['neutral-title-1'],
      fontSize: 18,
      fontWeight: '500',
      lineHeight: 23,
      textAlign: 'center',
    },
    list: {
      flexDirection: 'column',
      gap: 12,
    },
  });

function useQuestionsCheck() {
  const { t } = useTranslation();

  const QUESTIONS = React.useMemo(() => {
    return [
      {
        index: 1 as const,
        content: t('page.newAddress.seedPhrase.importQuestion1'),
        checked: false,
      },
      {
        index: 2 as const,
        content: t('page.newAddress.seedPhrase.importQuestion2'),
        checked: false,
      },
      {
        index: 3 as const,
        content: t('page.newAddress.seedPhrase.importQuestion3'),
        checked: false,
      },
    ];
  }, [t]);

  const [questionChecks, setQuestionChecks] = React.useState(QUESTIONS);

  type TIndex = (typeof QUESTIONS)[number]['index'];
  const toggleCheckedByIndex = React.useCallback((index: TIndex) => {
    setQuestionChecks(prev => {
      const idx = prev.findIndex(item => item.index === index);

      prev[idx].checked = !prev[idx].checked;

      return [...prev];
    });
  }, []);

  return {
    questionChecks,
    isAllChecked: React.useMemo(
      () => questionChecks.every(item => item.checked),
      [questionChecks],
    ),
    toggleCheckedByIndex,
  };
}

export const CreateSeedPhraseRickCheckScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const { questionChecks, isAllChecked, toggleCheckedByIndex } =
    useQuestionsCheck();

  const handleConfirm = useMemoizedFn(() => {
    navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.CreateMnemonicBackup,
    });
  });

  return (
    <FooterButtonScreenContainer
      btnProps={{
        disabled: !isAllChecked,
      }}
      buttonText={t('page.newAddress.seedPhrase.showSeedPhrase')}
      onPressButton={handleConfirm}>
      <View style={styles.tipsWarper}>
        <Text style={styles.tips}>
          {t('page.newAddress.seedPhrase.riskTips')}
        </Text>
      </View>
      <View style={styles.list}>
        {questionChecks.map(q => {
          return (
            <CheckboxItem
              key={q.index}
              checked={q.checked}
              value={q.index}
              label={q.content}
              onChange={toggleCheckedByIndex}
            />
          );
        })}
      </View>
    </FooterButtonScreenContainer>
  );
};
