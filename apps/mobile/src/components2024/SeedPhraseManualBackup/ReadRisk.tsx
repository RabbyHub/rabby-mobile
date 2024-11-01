import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import TouchableView from '@/components/Touchable/TouchableView';
import { createGetStyles2024 } from '@/utils/styles';
import { AppBottomSheetModalTitle } from '@/components/customized/BottomSheet';
import { Button } from '../Button';
import { CheckBoxRect } from '@/components2024/Checkbox/CheckBoxRect';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tipsWarper: {
    // marginTop: 20,
    marginBottom: 20,
  },
  tipsText: {
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontSize: 17,
    marginTop: 0,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  listText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    // textAlign: 'center',
    // width: '95%',
    flex: 1,
    fontFamily: 'SF Pro Rounded',
  },
  title: {
    // marginTop: -12,
  },
  dotItem: {
    marginLeft: 8,
    marginRight: 0,
    fontSize: 32,
    transform: [{ translateY: -12 }],
    // flex: 1,
    width: 16,
  },
  listContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    display: 'flex',
    width: '100%',
    gap: 12,
  },
  listItem: {
    // gap: 4,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    display: 'flex',
  },
  agreementWrapper: {
    height: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    marginTop: 12,
    // paddingHorizontal: 10,
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
    color: colors2024['neutral-foot'],
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
  container: {
    backgroundColor: colors2024['neutral-bg-1'],
    // paddingTop: 12,
    paddingBottom: 0,
    paddingHorizontal: 12,
    display: 'flex',
    flexDirection: 'column',
    // alignItems: 'space-around',
    // justifyContent: 'space-between',
    height: '95%',
    gap: 12,
    // height: "700",
  },
  btnContainer: {
    width: '100%',
  },
  content: {
    width: '100%',
    flex: 1,
  },
}));

interface Props {
  onConfirm: () => void;
}

export const ReadRisk: React.FC<Props> = ({ onConfirm }) => {
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
    <View style={styles.container}>
      <View style={styles.container}>
        <AppBottomSheetModalTitle
          style={styles.title}
          title={t('page.nextComponent.createNewAddress.BackupSeedPhrase')}
        />
        <View style={styles.tipsWarper}>
          <Text style={styles.tipsText}>
            {t('page.nextComponent.createNewAddress.riskTips')}
          </Text>
        </View>
        <View style={styles.listContainer}>
          {QUESTIONS.map(q => {
            return (
              <View style={styles.listItem} key={q.index}>
                <Text style={styles.dotItem}>{'·'}</Text>
                <Text style={styles.listText}>{q.content}</Text>
              </View>
            );
          })}
        </View>
        <TouchableView
          style={styles.agreementWrapper}
          onPress={() => {
            setChecked(!checked);
          }}>
          <View style={styles.agreementCheckbox}>
            <CheckBoxRect checked={checked} />
          </View>
          <View style={styles.agreementTextWrapper}>
            <Text style={styles.agreementText}>
              {t(
                'page.nextComponent.createNewAddress.UnderstandsecurityPrecautions',
              )}
            </Text>
          </View>
        </TouchableView>
      </View>
      <Button
        disabled={!checked}
        containerStyle={styles.btnContainer}
        type="primary"
        title={t('page.nextComponent.createNewAddress.Confirm')}
        onPress={onConfirm}
      />
    </View>
  );
};
