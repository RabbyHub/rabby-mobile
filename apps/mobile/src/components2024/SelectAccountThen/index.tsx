import { View, Text } from 'react-native';
import AutoLockView from '@/components/AutoLockView';
import { AccountsPanelInSheetModal } from '@/components/AccountSelector/AccountsPanel';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

export type SelectAccountThenProps = {
  modalTitle?: string;
  onDone: React.ComponentProps<
    typeof AccountsPanelInSheetModal
  >['onSelectAccount'];
};
export const SelectAccountThen: React.FC<SelectAccountThenProps> = ({
  modalTitle,
  onDone,
}) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <AutoLockView as="BottomSheetView">
      <View style={styles.container}>
        {modalTitle && (
          <BottomSheetHandlableView>
            <Text style={styles.title}>{modalTitle}</Text>
          </BottomSheetHandlableView>
        )}
        <AccountsPanelInSheetModal
          containerStyle={styles.accountRoot}
          onSelectAccount={onDone}
          scene="receive"
          defaultPressItemAction="copy"
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
