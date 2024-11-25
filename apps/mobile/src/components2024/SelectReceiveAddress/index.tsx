import { View, Text } from 'react-native';
import AutoLockView from '@/components/AutoLockView';
import { AccountsPanelInModal } from '@/components/AccountSwitcher/AccountsPanel';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

export const SelectReceiveAddress: React.FC<{
  onDone: () => void;
}> = ({ onDone }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <AutoLockView as="BottomSheetView">
      <View style={styles.container}>
        <Text style={styles.title}>Select Receive Address</Text>
        <AccountsPanelInModal
          containerStyle={styles.accountRoot}
          forScene="Receive"
          onSelectAccount={onDone}
        />
      </View>
    </AutoLockView>
  );
};

const getStyle = createGetStyles2024(ctx => ({
  container: {
    height: '100%',
  },
  accountRoot: {
    backgroundColor: 'transparent',
    maxHeight: '85%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-title-1'],
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 9,
  },
}));
