import { View, Image, Pressable } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { touchedFeedback } from '@/utils/touch';
import { Account } from '@/core/services/preference';
import { RootNames } from '@/constant/layout';
import { StackActions, useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';
import RcIconArrow from '@/assets/icons/home/setting';

type HomeProps = NativeStackScreenProps<RootStackParamsList>;

export function DepositAssetsCard({ account }: { account?: Account | null }) {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useNavigation<HomeProps['navigation']>();

  const handlePress = () => {
    touchedFeedback();
    if (!account) return;
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.Receive,
        params: {
          account,
        },
      }),
    );
  };

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.card}>
        <Image
          source={
            isLight
              ? require('@/assets/images/home_deposit_bg_light.png')
              : require('@/assets/images/home_deposit_bg_dark.png')
          }
          style={styles.backgroundImage}
          resizeMode="contain"
        />

        <View style={styles.textBox}>
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {t('page.home.depositAssets.title')}
            </Text>
            <Text style={styles.subtitle}>
              {t('page.home.depositAssets.subtitle')}
            </Text>
          </View>
          <RcIconArrow
            width={26}
            height={26}
            style={styles.settingIcon}
            color={colors2024['neutral-body']}
            backgroundColor={colors2024['neutral-line']}
          />
        </View>
      </View>
    </Pressable>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      width: '100%',
      paddingHorizontal: 16,
    },
    card: {
      width: '100%',
      borderRadius: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      overflow: 'hidden',
      shadowColor: 'rgba(55, 56, 63, 0.02)',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 1,
      shadowRadius: 40,
      elevation: 2,
    },
    backgroundImage: {
      width: '100%',
      height: 146,
    },
    textBox: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-5']
        : colors2024['neutral-bg-1'],
      borderRadius: 12,
      marginBottom: 16,
      marginHorizontal: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    textContainer: {
      alignItems: 'center',
    },
    settingIcon: {
      width: 26,
      height: 26,
      position: 'absolute',
      right: 16,
    },
    subtitle: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
      textAlign: 'center',
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 24,
      color: colors2024['neutral-title-1'],
      textAlign: 'center',
      marginBottom: 6,
    },
  };
});
