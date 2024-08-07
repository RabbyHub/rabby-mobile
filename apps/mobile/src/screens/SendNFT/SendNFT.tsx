import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useThemeStyles } from '@/hooks/theme';
import { TransactionNavigatorParamList } from '@/navigation-type';
import { createGetStyles } from '@/utils/styles';
import { useNavigationState } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export default function SendNFT() {
  const { styles } = useThemeStyles(getStyles);
  const navParams = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.SendNFT)?.params,
  ) as TransactionNavigatorParamList['SendNFT'] | undefined;

  console.debug('navParams', navParams);

  return (
    <NormalScreenContainer style={styles.container}>
      <View style={styles.sendNFTScreen}>
        <KeyboardAwareScrollView contentContainerStyle={styles.mainContent}>
          <Text>Send NFT</Text>
        </KeyboardAwareScrollView>
      </View>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles(colors => ({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors['neutral-card2'],
    position: 'relative',
  },
  sendNFTScreen: {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  mainContent: {
    width: '100%',
    // height: '100%',
    alignItems: 'center',
    padding: 20,
    paddingTop: 0,
  },
}));
