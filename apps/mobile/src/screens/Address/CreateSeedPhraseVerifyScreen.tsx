import { Button } from '@/components/Button';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { apiKeyring, apiMnemonic } from '@/core/apis';
import { keyringService } from '@/core/services';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
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

  const { data } = useRequest(async () => {
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

  const [selectedWord, setSelectedWords] = React.useState<string[]>([]);
  const [isShowDialog, setShowDialog] = React.useState(false);

  const validate = useMemoizedFn(() => {
    if (selectedWord.length !== 3) {
      return false;
    }
    return selectedWord.every((word, index) => {
      const number = data?.shuffledNumbers?.[index];
      if (number == null) {
        return false;
      }
      return data?.words.indexOf(word) === number - 1;
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
        const { keyringId, isExistedKR } =
          await apiMnemonic.generateKeyringWithMnemonic(mnemonics, passphrase);

        const firstAddress = apiKeyring.requestKeyring(
          KEYRING_TYPE.HdKeyring,
          'getAddresses',
          keyringId ?? null,
          0,
          1,
        );

        await new Promise(resolve => setTimeout(resolve, 1));
        await apiMnemonic.activeAndPersistAccountsByMnemonics(
          mnemonics,
          passphrase,
          firstAddress as any,
          true,
        );
        keyringService.removePreMnemonics();
        return navigate(RootNames.StackAddress, {
          screen: RootNames.ImportSuccess,
          params: {
            type: KEYRING_TYPE.HdKeyring,
            brandName: KEYRING_CLASS.MNEMONIC,
            isFirstImport: true,
            address: [firstAddress?.[0].address],
            mnemonics,
            passphrase,
            keyringId: keyringId || undefined,
            isExistedKR: isExistedKR,
          },
        });
      } catch (error) {
        console.log('error', error);
      }
    },
    {
      manual: true,
    },
  );

  return (
    <FooterButtonScreenContainer
      btnProps={{
        disabled: selectedWord.length < 3,
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
        {data?.shuffledWords.map(word => {
          const selectedIndex = selectedWord.findIndex(item => item === word);
          const isSelected = selectedIndex !== -1;
          const selectedNumber = isSelected
            ? data?.shuffledNumbers?.[selectedIndex]
            : null;
          return (
            <View style={styles.gridItemWarper} key={word}>
              <TouchableWithoutFeedback
                onPress={() => {
                  if (isSelected || selectedWord.length >= 3) {
                    return;
                  }
                  setSelectedWords([...selectedWord, word]);
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
              setSelectedWords([]);
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
