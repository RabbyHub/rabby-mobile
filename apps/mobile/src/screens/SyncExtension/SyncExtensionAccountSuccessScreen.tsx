import { useEffect } from 'react';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { ScrollView, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { AddressItemInner2024 } from '../Address/components/AddressItemInner2024';
import AnimationImportSuccess from '@/assets2024/animations/animation-import-success.json';
import Lottie from 'lottie-react-native';
import { toast } from '@/components2024/Toast';
import { RootNames } from '@/constant/layout';
import { AddressNavigatorParamList } from '@/navigation-type';
import { useNavigationState } from '@react-navigation/native';

export const SyncExtensionAccountSuccessfulScreen = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const navigation = useRabbyAppNavigation();

  const navState = useNavigationState(
    s =>
      s.routes.find(e => e.name === RootNames.SyncExtensionAccountSuccess)
        ?.params,
  ) as AddressNavigatorParamList['SyncExtensionAccountSuccess'];

  const handleConfirm = async () => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: RootNames.StackRoot,
          params: {
            screen: RootNames.Home,
          },
        },
      ],
    });
  };

  console.log('navState?.newAccounts', navState);

  useEffect(() => {
    toast.success(t('page.syncExtension.importedSuccessfully'));
  }, [t]);

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('global.Done'),
        onPress: handleConfirm,
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={styles.ph}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {navState?.newAccounts?.map(e => (
          <AddressItemInner2024
            style={styles.account}
            account={e}
            key={e.address + e.type}
            hiddenArrow
          />
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>
      <View pointerEvents="none" style={[styles.animationLayer]}>
        <Lottie
          style={styles.animationLottie}
          source={AnimationImportSuccess}
          loop={false}
          autoPlay
          direction={1}
        />
      </View>
    </FooterButtonScreenContainer>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },

  ph: {
    paddingHorizontal: 20,
  },

  scrollContent: {
    paddingTop: 36,
    paddingHorizontal: 20,
    gap: 12,
  },

  animationLayer: {
    height: '100%',
    position: 'absolute',
    zIndex: 999,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  animationLottie: {
    width: '100%',
    height: '100%',
  },
  account: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: ctx.colors2024['neutral-line'],
  },
}));
