import { Button } from '@/components/Button';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { apiKeyring } from '@/core/apis';
import {
  createKeyringWithMnemonics,
  getKeyringByMnemonic,
  getMnemonicKeyRingIdFromPublicKey,
  getPreMnemonics,
} from '@/core/apis/mnemonic';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import {
  BRAND_ALIAS_TYPE_TEXT,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import { Dialog } from '@rneui/themed';
import { useMemoizedFn, useRequest } from 'ahooks';
import _ from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';

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

export const CreateSeedPhraseVerifyScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  const { data } = useRequest(async () => {
    const seedPhrase: string = await getPreMnemonics();
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

  const handleConfirm = useMemoizedFn(async () => {
    if (!validate()) {
      setShowDialog(true);
      return;
    }
    if (!data?.seedPhrase) {
      return;
    }

    await createKeyringWithMnemonics(data?.seedPhrase);
    // Passphrase is not supported on new creation
    const keyring = await getKeyringByMnemonic(data?.seedPhrase, '');
    const keyringId = await getMnemonicKeyRingIdFromPublicKey(
      keyring!.publicKey!,
    );

    const accountsToImport = keyring?.getAddresses(0, 1);

    // openInternalPageInTab(
    //   `import/select-address?hd=${KEYRING_CLASS.MNEMONIC}&keyringId=${keyringId}`
    // );

    console.log(accountsToImport);

    await apiKeyring.requestKeyring(
      KEYRING_TYPE.HdKeyring,
      'activeAccounts',
      keyringId ?? null,
      [0],
    );
    await apiKeyring.addKeyring(keyringId, false);

    // apiMnemonic.activeAndPersistAccountsByMnemonics(
    //   store.importMnemonics.finalMnemonics,
    //   store.importMnemonics.passphrase,
    //   accountsToImport,
    // );

    navigate(RootNames.StackAddress, {
      screen: RootNames.ImportSuccess,
      params: {
        type: KEYRING_TYPE.HdKeyring,
        brandName: BRAND_ALIAS_TYPE_TEXT[KEYRING_TYPE.HdKeyring],
        address: accountsToImport?.[0].address,
      },
    });
  });

  return (
    <FooterButtonScreenContainer
      buttonDisabled={selectedWord.length < 3}
      buttonText={'Next'}
      onPressButton={handleConfirm}>
      <View style={styles.tipsWarper}>
        <Text style={styles.tips}>
          Select the{' '}
          {data?.shuffledNumbers.map((number, index, list) => {
            return (
              <>
                <Text style={styles.textStrong}>#{number}</Text>
                {index !== list.length - 1 && <Text>, </Text>}
              </>
            );
          })}{' '}
          of your seed phrase in order.
        </Text>
      </View>
      <View style={styles.grid}>
        {data?.shuffledWords.map((word, index) => {
          const selectedIndex = selectedWord.findIndex(item => item === word);
          const isSelected = selectedIndex !== -1;
          const selectedNumber = isSelected
            ? data?.shuffledNumbers?.[selectedIndex]
            : null;
          return (
            <View style={styles.gridItemWarper} key={index}>
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
