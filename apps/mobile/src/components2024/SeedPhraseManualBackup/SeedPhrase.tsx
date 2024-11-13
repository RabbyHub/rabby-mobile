import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { useMemoizedFn } from 'ahooks';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { default as RcIconEye } from '@/assets/icons/nextComponent/IconEye.svg';
import { AppBottomSheetModalTitle } from '@/components/customized/BottomSheet';
import _ from 'lodash';
import { Button } from '../Button';
import { WordsMatrix } from '@/components2024/WordsMatrix';
import { replaceToFirst } from '@/utils/navigation';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { toast } from '@/components/Toast';
import { activeAndPersistAccountsByMnemonics } from '@/core/apis/mnemonic';
import { keyringService } from '@/core/services';
import { type Account } from '@/core/services/preference';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tipsWrapper: {
    marginTop: 20,
    height: 66,
    display: 'flex',
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    // ...makeDebugBorder(),
  },
  blueText: {
    marginHorizontal: 4,
    fontWeight: '700',
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
    fontSize: 17,
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
  verifyTipsText: {
    width: '100%',
    maxWidth: 190,
    // ...makeDebugBorder(),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
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
    flexShrink: 0,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
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
  },
  rootContainer: {
    paddingHorizontal: 24,
    paddingBottom: SIZES.btnContainerBottom,
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    // ...makeDebugBorder('red'),
  },
  container: {
    flexShrink: 1,
    paddingBottom: 0,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    // ...makeDebugBorder('yellow'),
  },
  btnWrapper: {
    flexShrink: 0,
    height: 56,
    marginTop: SIZES.btnContainerTopOffset,
    // position: 'absolute',
    // bottom: 35,
  },
  btnContainer: {
    width: '100%',
    height: '100%',
  },
  content: {
    width: '100%',
    flex: 1,
  },
  wordContainer: {
    position: 'relative',
    marginTop: 36,
    flexShrink: 1,
    height: '100%',
    flexDirection: 'column',
  },
  blurViewContainer: {
    maxHeight: 430,
    overflow: 'hidden',
  },
  wordsMatrix: {
    // ...makeDebugBorder('pink'),
    marginRight: -8,
  },
  mask: {
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
  paramState: {
    address: string;
    alias: string;
    seedPhrase: string;
    accountsToCreate?: Required<Pick<Account, 'address' | 'aliasName'>>[];
  };
}

const SIZES = {
  btnContainerTopOffset: 28,
  btnContainerBottom: 35,
};

export const SeedPhrase: React.FC<Props> = ({ onConfirm, paramState }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [isHidden, setIsHidden] = React.useState(true);
  const [isSelect, setIsSelect] = React.useState(false);
  const [selectArr, setSelectArr] = React.useState<number[]>([]);

  const appThemeMode = useGetBinaryMode();
  const { seedPhrase, alias, address, accountsToCreate = [] } = paramState;

  const [shuffleCount, setShuffleCount] = React.useState(0);
  const words = useMemo(() => seedPhrase.split(' ') || [], [seedPhrase]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffledWords = useMemo(() => _.shuffle(words), [words, shuffleCount]);
  const shuffledNumbers = useMemo(
    () => _.sortBy(_.shuffle(_.range(1, words.length + 1)).slice(0, 3)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [words, shuffleCount],
  );
  const onSelect = useCallback(
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
      const number = shuffledNumbers?.[index];
      const word = shuffledWords?.[n];
      if (number == null || !word) {
        return false;
      }
      return words[number - 1] === word;
    });
  });

  const handleVerify = useMemoizedFn(async () => {
    if (validate()) {
      const mnemonics = seedPhrase;
      const passphrase = '';
      try {
        await activeAndPersistAccountsByMnemonics(
          mnemonics,
          passphrase,
          accountsToCreate,
          false,
        );
        keyringService.removePreMnemonics();
        replaceToFirst(RootNames.StackAddress, {
          screen: RootNames.ImportSuccess2024,
          params: {
            type: KEYRING_TYPE.HdKeyring,
            brandName: KEYRING_CLASS.MNEMONIC,
            isFirstImport: true,
            isFirstCreate: true,
            address: [address],
            mnemonics,
            passphrase,
            isExistedKR: false,
            alias,
          },
        });
        onConfirm?.();
      } catch (e) {
        console.log('addMnemonicKeyringAndGotoSuccessScreen error', e);
      }
    } else {
      toast.show('Verification failed');
      setShuffleCount(val => val + 1);
    }
  });

  const handleGoSelect = useMemoizedFn(() => {
    setIsSelect(true);
  });

  const currentSelecting = useMemo(
    () => !isHidden && isSelect,
    [isSelect, isHidden],
  );

  const { safeSizes } = useSafeAndroidBottomSizes({
    ...SIZES,
  });

  const WordMatrixWrapper = isHidden ? View : BottomSheetScrollView;

  return (
    <View
      style={[
        styles.rootContainer,
        { paddingBottom: safeSizes.btnContainerBottom },
      ]}>
      <View style={[styles.container]}>
        <BottomSheetHandlableView>
          <AppBottomSheetModalTitle
            style={styles.title}
            title={
              !currentSelecting
                ? t('page.nextComponent.createNewAddress.WriteDownSeedPhrase')
                : t('page.nextComponent.createNewAddress.VerifyDownSeedPhrase')
            }
          />
          <View style={styles.tipsWrapper}>
            {!currentSelecting ? (
              <Text style={styles.tipsText}>
                {t('page.nextComponent.createNewAddress.WriteSeedPhrase')}
              </Text>
            ) : (
              <View style={styles.verifyTipsText}>
                <Text style={styles.tipsText}>
                  {t('page.nextComponent.createNewAddress.selectWords')}
                </Text>
                <Text style={styles.blueText}>
                  {`#${shuffledNumbers[0]}, #${shuffledNumbers[1]}, and #${shuffledNumbers[2]}`}
                </Text>
                <Text style={styles.tipsText}>
                  {t('page.nextComponent.createNewAddress.inOrder')}
                </Text>
              </View>
            )}
          </View>
        </BottomSheetHandlableView>
        <WordMatrixWrapper
          style={[styles.wordContainer, isHidden && styles.blurViewContainer]}>
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
            words={!currentSelecting ? words : shuffledWords}
            selectArr={selectArr}
            isSelectIng={currentSelecting}
            onSelect={onSelect}
            style={[styles.wordsMatrix]}
          />
        </WordMatrixWrapper>
      </View>
      <View style={[styles.btnWrapper]}>
        {!isHidden && (
          <Button
            containerStyle={styles.btnContainer}
            type="primary"
            title={
              currentSelecting
                ? t('page.nextComponent.createNewAddress.Verify')
                : t('page.nextComponent.createNewAddress.savedPhrase')
            }
            onPress={currentSelecting ? handleVerify : handleGoSelect}
          />
        )}
      </View>
    </View>
  );
};
