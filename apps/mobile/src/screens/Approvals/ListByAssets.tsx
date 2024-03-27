import { View, Text, TextInput } from 'react-native';
import { ApprovalsTabView } from './components/Layout';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { TopSearch } from './components/TopSearch';

export default function ListByContracts() {
  const { colors, styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  return (
    <ApprovalsTabView
      ViewComponent={KeyboardAwareScrollView}
      style={styles.container}
      contentContainerStyle={styles.container}
      enableOnAndroid
      extraHeight={20}
      keyboardOpeningTime={0}
      innerStyle={[
        styles.innerContainer,
        // makeDebugBorder('red')
      ]}>
      {/* Search input area */}

      <TopSearch filterType={'assets'} />
      <Text>List by Assets</Text>
    </ApprovalsTabView>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      flex: 1,
    },

    innerContainer: {
      paddingVertical: 0,
      paddingHorizontal: 20,
    },
  };
});
