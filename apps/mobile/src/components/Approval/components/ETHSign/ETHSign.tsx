import { FooterButton } from '@/components/FooterButton/FooterButton';
import { useApproval } from '@/hooks/useApproval';
import { createGetStyles } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useThemeStyles } from '@/hooks/theme';
import ImgWarning from '@/assets/icons/swap/warn.svg';

export const ETHSign = () => {
  const [, , rejectApproval] = useApproval();
  const { t } = useTranslation();
  const { styles } = useThemeStyles(getStyle);
  const onCancel = () => {
    rejectApproval('User rejected the request.');
  };

  return (
    <View style={styles.root}>
      <View style={styles.main}>
        <ImgWarning width={52} height={52} />
        <Text style={styles.text}>{t('page.ethSign.alert')}</Text>
      </View>

      <FooterButton title="Cancel" onPress={onCancel} />
    </View>
  );
};

const getStyle = createGetStyles(colors => {
  return {
    root: {
      height: '100%',
    },
    main: {
      flex: 1,
      paddingHorizontal: 15,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    text: {
      fontSize: 17,
      color: colors['neutral-title-1'],
      textAlign: 'center',
      fontWeight: '500',
      lineHeight: 22,
    },
  };
});
