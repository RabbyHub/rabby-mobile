import { Button } from '@/components/Button';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { AppColorsVariants } from '@/constant/theme';
import { apiMnemonic } from '@/core/apis';
import { useThemeColors } from '@/hooks/theme';
import { Dialog } from '@rneui/themed';
import { useMemoizedFn, useRequest } from 'ahooks';
import _ from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';

export const CreateSeedPhraseVerifyScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  const { data, runAsync: runShuffle } = useRequest(async () => {
    const seedPhrase: string = await apiMnemonic.getPreMnemonics();
    const words = seedPhrase.split(' ');
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

  const [selectedWordIndexes, setSelectedWordIndexes] = React.useState<
    number[]
  >([]);
  const [isShowDialog, setShowDialog] = React.useState(false);

  const validate = useMemoizedFn(() => {
    if (selectedWordIndexes.length !== 3) {
      return false;
    }
    return selectedWordIndexes.every((n, index) => {
      const number = data?.shuffledNumbers?.[index];
      const word = data?.shuffledWords?.[n];
      if (number == null || !word) {
        return false;
      }
      return data?.words[number - 1] === word;
    });
  });

  const { loading: isSubmitting, runAsync: handleConfirm } = useRequest(
    async () => {
      if (!validate()) {
        setShowDialog(true);
        return;
      }
      if (!data?.seedPhrase) {
        return;
      }

      const mnemonics = data.seedPhrase;
      const passphrase = '';
      try {
        await apiMnemonic.addMnemonicKeyringAndGotoSuccessScreen(
          mnemonics,
          passphrase,
        );
      } catch (e) {
        console.log('addMnemonicKeyringAndGotoSuccessScreen error', e);
      }
    },
    {
      manual: true,
    },
  );

  return (
    <FooterButtonScreenContainer
      btnProps={{
        disabled: selectedWordIndexes.length < 3,
        loading: isSubmitting,
      }}
      buttonText={'Next'}
      onPressButton={handleConfirm}>
      <View style={styles.tipsWarper}>
        <Text style={styles.tips}>
          Select the{' '}
          {data?.shuffledNumbers.map((number, index, list) => {
            return (
              <Text key={number}>
                <Text style={styles.textStrong}>#{number}</Text>
                {index !== list.length - 1 ? <Text>, </Text> : null}
              </Text>
            );
          })}{' '}
          of your seed phrase in order.
        </Text>
      </View>
      <View style={styles.grid}>
        {data?.shuffledWords.map((word, index) => {
          const selectedIndex = selectedWordIndexes.findIndex(
            item => item === index,
          );
          const isSelected = selectedIndex !== -1;
          const selectedNumber = isSelected
            ? data?.shuffledNumbers?.[selectedIndex]
            : null;
          return (
            <View style={styles.gridItemWarper} key={index}>
              <TouchableWithoutFeedback
                onPress={() => {
                  if (isSelected) {
                    setSelectedWordIndexes(prev => {
                      return prev.filter(item => item !== index);
                    });
                  } else if (selectedWordIndexes.length < 3) {
                    setSelectedWordIndexes([...selectedWordIndexes, index]);
                  }
                }}>
                <View
                  style={[
                    styles.gridItem,
                    isSelected && styles.gridItemSelected,
                  ]}>
                  {selectedNumber ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{selectedNumber}.</Text>
                    </View>
                  ) : null}
                  <Text
                    style={[
                      styles.wordText,
                      isSelected && styles.wordTextSelected,
                    ]}>
                    {word}
                  </Text>
                </View>
              </TouchableWithoutFeedback>
            </View>
          );
        })}
      </View>
      <Dialog
        overlayStyle={styles.dialog}
        backdropStyle={styles.dialogMask}
        onBackdropPress={() => {
          setShowDialog(false);
        }}
        isVisible={isShowDialog}>
        <View style={styles.dialogHeader}>
          <Text style={styles.dialogTitle}>Verification failed</Text>
        </View>
        <View style={styles.dialogBody}>
          <Text style={styles.dialogContent}>
            Fail to verify your seed phrase. You've selected the wrong words.
          </Text>
        </View>
        <View style={styles.dialogFooter}>
          <Button
            title="Try again"
            onPress={() => {
              setShowDialog(false);
              setSelectedWordIndexes([]);
              runShuffle();
            }}
          />
        </View>
      </Dialog>
    </FooterButtonScreenContainer>
  );
};

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
    textStrong: {
      color: colors['blue-default'],
    },
    grid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      paddingHorizontal: -5,
      rowGap: 11,
      marginBottom: 24,
    },
    gridItemWarper: {
      width: '50%',
      minWidth: 0,
      paddingHorizontal: 5,
    },
    gridItem: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,

      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 64,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    gridItemSelected: {
      borderColor: colors['blue-default'],
      backgroundColor: colors['blue-light-1'],
    },
    badge: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      padding: 10,

      display: 'flex',
      justifyContent: 'center',
    },
    badgeText: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '500',
    },
    wordText: {
      textAlign: 'center',
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '500',
    },
    wordTextSelected: {
      color: colors['blue-default'],
    },
    dialog: {
      borderRadius: 16,
      padding: 0,
      backgroundColor: colors['neutral-bg-1'],
      width: 353,
      maxWidth: '100%',
    },
    dialogMask: {
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    dialogHeader: {
      paddingHorizontal: 20,
      paddingTop: 20,
      marginBottom: 16,
    },
    dialogTitle: {
      color: colors['neutral-title-1'],
      fontSize: 20,
      fontWeight: '500',
      lineHeight: 24,
      textAlign: 'center',
    },
    dialogBody: {
      paddingHorizontal: 20,
      minHeight: 85,
    },
    dialogContent: {
      color: colors['neutral-body'],
      fontSize: 16,
      lineHeight: 19,
      textAlign: 'center',
    },
    dialogFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors['neutral-line'],
      padding: 20,
    },
  });
