import { useTheme2024 } from '@/hooks/theme';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import TouchableView from '@/components/Touchable/TouchableView';
import { createGetStyles2024 } from '@/utils/styles';
import { AppBottomSheetModalTitle } from '@/components/customized/BottomSheet';
import { Button } from '../Button';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tipsWarper: {
    marginTop: 20,
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
    flex: 1,
    fontFamily: 'SF Pro Rounded',
  },
  title: {
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  dotItem: {
    marginLeft: 8,
    marginRight: 0,
    fontSize: 24,
    transform: [{ translateY: -12 }],
    width: 16,
    fontFamily: 'SF Pro Rounded',
  },
  listContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    display: 'flex',
    width: '100%',
    marginTop: 56,
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
    alignItems: 'center',
    flexWrap: 'nowrap',
    marginTop: 16,
  },
  agreementCheckbox: {
    marginRight: 6,
    position: 'relative',
    // top: 1,
  },
  agreementTextWrapper: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexWrap: 'nowrap',
    top: 2,
  },
  agreementText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  userAgreementTouchText: {
    fontSize: 14,
    color: colors2024['blue-default'],
  },
  userAgreementTouchable: {
    padding: 0,
  },
  rootContainer: {
    paddingHorizontal: 24,
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
  },
  container: {
    paddingBottom: 0,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  btnContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 56,
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
  const [checked, setChecked] = useState(true);

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
    <View style={styles.rootContainer}>
      <BottomSheetHandlableView style={styles.container}>
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
      </BottomSheetHandlableView>
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
