import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { CheckboxItem } from './components/CheckboxItem';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { RcIconInfoCC } from '@/assets/icons/common';
import { ListItem } from '../ListItem/ListItem';
import TouchableView from '@/components/Touchable/TouchableView';
import { createGetStyles2024 } from '@/utils/styles';
import { CheckBoxCircled } from '@/components/Icons/Checkbox';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tipsWarper: {
    marginTop: 40,
    marginBottom: 24,
  },
  tips: {
    color: colors2024['neutral-title-1'],
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 23,
    textAlign: 'center',
  },
  list: {
    flexDirection: 'column',
    gap: 12,
  },
  agreementWrapper: {
    position: 'absolute',
    bottom: 72,
    height: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    paddingHorizontal: 32,
  },
  agreementCheckbox: {
    marginRight: 6,
    position: 'relative',
    top: 1,
  },
  agreementTextWrapper: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  agreementText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors2024['neutral-body'],
  },
  userAgreementTouchText: {
    fontSize: 14,
    color: colors2024['blue-default'],
  },
  userAgreementTouchable: {
    padding: 0,
    // position: 'relative',
    // top: 0,
    // ...makeDebugBorder(),
  },
}));

interface Props {
  onConfirm: () => void;
}

export const WriteSeedPhrase: React.FC<Props> = ({ onConfirm }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [checked, setChecked] = React.useState(false);

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

  return (
    <FooterButtonScreenContainer
      btnProps={{
        disabled: !checked,
      }}
      buttonText={t('page.newAddress.seedPhrase.showSeedPhrase')}
      onPressButton={onConfirm}>
      <View style={styles.tipsWarper}>
        <Text style={styles.tips}>
          {t('page.newAddress.seedPhrase.riskTips')}
        </Text>
      </View>
      <View style={styles.list}>
        {QUESTIONS.map(q => {
          return (
            <>
              <Text>{'·'}</Text>
              <ListItem title={q.content} />
            </>
          );
        })}
      </View>
      <TouchableView
        style={styles.agreementWrapper}
        onPress={() => {
          setChecked(!checked);
        }}>
        <View style={styles.agreementCheckbox}>
          <CheckBoxCircled checked={checked} />
        </View>
        <View style={styles.agreementTextWrapper}>
          <Text style={styles.agreementText}>
            {t(
              'page.nextComponent.createNewAddress.UnderstandsecurityPrecautions',
            )}
          </Text>
        </View>
      </TouchableView>
    </FooterButtonScreenContainer>
  );
};
