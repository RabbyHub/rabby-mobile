import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { AppColorsVariants } from '@/constant/theme';
import { useGetBinaryMode, useTheme2024, useThemeColors } from '@/hooks/theme';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { BlurView, BlurViewProps } from '@react-native-community/blur';
import TouchableView from '@/components/Touchable/TouchableView';
import { createGetStyles2024 } from '@/utils/styles';
import { CheckBoxCircled } from '@/components/Icons/Checkbox';
import { default as RcIconEye } from '@/assets/icons/nextComponent/IconEye.svg';
import { AppBottomSheetModalTitle } from '@/components/customized/BottomSheet';
import _ from 'lodash';
import { Button } from '../Button';
import { WordsMatrix } from '@/components2024/WordsMatrix';
import { apiMnemonic } from '@/core/apis';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { toast } from '@/components/Toast';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tipsWarper: {
    // marginTop: 20,
    marginBottom: 20,
    display: 'flex',
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipsWarperBottom: {
    marginBottom: 40,
  },
  blueText: {
    marginHorizontal: 4,
    fontWeight: '700',
    color: colors2024['brand-default'],
    lineHeight: 22,
  },
  tipsText: {
    lineHeight: 22,
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
    // height: 180,
    marginTop: 25,
  },
  content: {
    width: '100%',
    flex: 1,
  },
  wordContainer: {
    position: 'relative',
  },
  mask: {
    // backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 1,
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  maskWraper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  tapText: {
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  tapDesc: {
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
}));

interface Props {
  onConfirm: () => void;
}

export const WriteSeedPhrase: React.FC<Props> = ({ onConfirm }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [isHidden, setIsHidden] = React.useState(true);
  const [selectArr, setSelectArr] = React.useState<number[]>([]);

  const appThemeMode = useGetBinaryMode();
  const { data } = useRequest(async () => {
    const seedPhrase = await apiMnemonic.getPreMnemonics();
    const words = seedPhrase.split(' ') || [];
    const shuffledWords = _.shuffle(words);
    const shuffledNumbers = _.sortBy(
      _.shuffle(_.range(1, words.length + 1)).slice(0, 3),
    );

    return {
      seedPhrase,
      shuffledWords,
      shuffledNumbers,
      words,
    };
  });

  const { shuffledWords, shuffledNumbers, words, seedPhrase } = data || {
    shuffledWords: [],
    shuffledNumbers: [],
    words: [],
  };

  console.log('words', words);
  const handleSelect = useCallback(
    (index: number) => {
      if (isHidden) {
        return;
      }

      const idx = selectArr.indexOf(index);
      const newArr = [...selectArr];
      if (idx > -1) {
        newArr.splice(idx, 1);
      } else {
        newArr.push(index);
      }
      setSelectArr(newArr);
    },
    [selectArr, isHidden],
  );

  const validate = useMemoizedFn(() => {
    if (selectArr.length !== 3) {
      return false;
    }
    return selectArr.every((n, index) => {
      const number = data?.shuffledNumbers?.[index];
      const word = shuffledWords?.[n];
      if (number == null || !word) {
        return false;
      }
      return words[number - 1] === word;
    });
  });

  const handleVerify = async () => {
    if (validate()) {
      const mnemonics = seedPhrase;
      const passphrase = '';
      try {
        await apiMnemonic.addMnemonicKeyringAndGotoSuccessScreen(
          mnemonics,
          passphrase,
        );
        onConfirm?.();
      } catch (e) {
        console.log('addMnemonicKeyringAndGotoSuccessScreen error', e);
      }
    } else {
      toast.show('Verification failed');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.container}>
        <AppBottomSheetModalTitle
          style={styles.title}
          title={
            isHidden
              ? t('page.nextComponent.createNewAddress.WriteDownSeedPhrase')
              : t('page.nextComponent.createNewAddress.VerifyDownSeedPhrase')
          }
        />
        <View
          style={StyleSheet.flatten([
            styles.tipsWarper,
            !isHidden && styles.tipsWarperBottom,
          ])}>
          {isHidden ? (
            <Text style={styles.tipsText}>
              {t('page.nextComponent.createNewAddress.WriteSeedPhrase')}
            </Text>
          ) : (
            <>
              <Text style={styles.tipsText}>
                {t('page.nextComponent.createNewAddress.selectWords')}
              </Text>
              <Text style={styles.blueText}>
                {`#${shuffledNumbers[0]}, #${shuffledNumbers[1]}, and #${shuffledNumbers[2]}`}
              </Text>
              <Text style={styles.tipsText}>
                {t('page.nextComponent.createNewAddress.inOrder')}
              </Text>
            </>
          )}
        </View>
        <View style={styles.wordContainer}>
          {isHidden && (
            <BlurView
              style={styles.mask}
              blurType={appThemeMode ?? 'light'}
              blurAmount={3}>
              <View style={styles.maskWraper}>
                <TouchableWithoutFeedback
                  onPress={() => {
                    setIsHidden(false);
                  }}>
                  <RcIconEye />
                </TouchableWithoutFeedback>
                <Text style={styles.tapText}>
                  Tap to reveal your seed phrase
                </Text>
                <Text style={styles.tapDesc}>
                  Make sure no one is watching your screen.
                </Text>
              </View>
            </BlurView>
          )}
          <WordsMatrix
            words={isHidden ? words : shuffledWords}
            selectArr={selectArr}
            isSelectIng={!isHidden}
            onSelect={handleSelect}
          />
        </View>
      </View>
      {!isHidden && (
        <Button
          containerStyle={styles.btnContainer}
          type="primary"
          title={t('page.nextComponent.createNewAddress.Confirm')}
          onPress={handleVerify}
        />
      )}
    </View>
  );
};
