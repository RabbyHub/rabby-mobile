import { RcIconInfo2CC } from '@/assets/icons/common';
import {
  CopyAddressIcon,
  CopyAddressIconType,
} from '@/components/AddressViewer/CopyAddress';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { toast } from '@/components/Toast';
import { WordsMatrix } from '@/components/WordsMatrix';
import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { apiMnemonic } from '@/core/apis';
import { useThemeColors } from '@/hooks/theme';
import { navigateDeprecated } from '@/utils/navigation';
import { useMemoizedFn, useRequest } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';

export const CreateSeedPhraseBackupScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  const copyAddressRef = React.useRef<CopyAddressIconType>(null);

  const handleConfirm = useMemoizedFn(() => {
    navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.CreateMnemonicVerify,
    });
  });

  const { data: seedPhrase } = useRequest(async () => {
    const res = await apiMnemonic.getPreMnemonics();
    return res as string;
  });

  const words = React.useMemo(() => {
    return seedPhrase?.split(' ') || [];
  }, [seedPhrase]);

  console.log(words);

  return (
    <FooterButtonScreenContainer
      buttonText={"I've saved the phrase"}
      onPressButton={handleConfirm}>
      <View style={styles.alert}>
        <RcIconInfo2CC width={20} height={20} color={colors['red-default']} />
        <Text style={styles.alertText}>
          {t('page.newAddress.seedPhrase.backupTips')}
        </Text>
      </View>
      <View style={styles.main}>
        <WordsMatrix words={words} />
      </View>
      <TouchableWithoutFeedback
        onPress={() => copyAddressRef.current?.doCopy()}>
        <View style={styles.copy}>
          <CopyAddressIcon
            ref={copyAddressRef}
            address={seedPhrase || ''}
            onToastSuccess={() => toast.success('Copied')}
          />
          <Text style={styles.copyText}>Copy seed phrase</Text>
        </View>
      </TouchableWithoutFeedback>
    </FooterButtonScreenContainer>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    alert: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 12,
      backgroundColor: colors['red-light'],
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors['red-default'],
      marginTop: 8,

      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,

      marginBottom: 20,
    },
    alertText: {
      color: colors['red-default'],
      fontSize: 14,
      lineHeight: 17,
      flex: 1,
      minWidth: 0,
    },
    main: {
      marginBottom: 20,
    },
    copy: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 24,
    },
    copyText: {
      color: colors['neutral-body'],
      fontSize: 15,
      lineHeight: 18,
    },
  });
