import React from 'react';
import { Platform, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import {
  useSendTokenFormik,
  useSendTokenInternalContext,
} from '../hooks/useSendToken';
import { createGetStyles2024 } from '@/utils/styles';
import { ModalConfirmAllowTransfer } from '@/components/Address/SheetModalConfirmAllowTransfer';
import { ModalAddToContacts } from '@/components/Address/SheetModalAddToContacts';
import { apiBalance } from '@/core/apis';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { Button } from '@/components2024/Button';

const isAndroid = Platform.OS === 'android';

export default function BottomArea() {
  const { styles } = useTheme2024({ getStyle });

  const { handleSubmit } = useSendTokenFormik();

  const {
    formValues,
    screenState,
    computed: { canSubmit, toAddressInContactBook },
    fns: { putScreenState, fetchContactAccounts },
  } = useSendTokenInternalContext();

  const { isSubmitLoading, addressToAddAsContacts } = screenState;

  const [isAllowTransferModalVisible, setIsAllowTransferModalVisible] =
    React.useState(false);

  const { safeOffBottom } = useSafeSizes();

  return (
    <View
      style={[
        styles.bottomDockArea,
        isAndroid && { paddingBottom: 20 + safeOffBottom },
      ]}>
      <Button
        disabled={!canSubmit}
        type="primary"
        title={'Send'}
        loading={isSubmitLoading}
        onPress={handleSubmit}
      />

      <ModalConfirmAllowTransfer
        toAddr={formValues.to}
        visible={isAllowTransferModalVisible}
        showAddToWhitelist={toAddressInContactBook}
        onFinished={() => {
          putScreenState?.({ temporaryGrant: true });
          setIsAllowTransferModalVisible(false);
        }}
        onCancel={() => {
          setIsAllowTransferModalVisible(false);
        }}
      />

      <ModalAddToContacts
        addrToAdd={addressToAddAsContacts || ''}
        onFinished={async result => {
          putScreenState({ addressToAddAsContacts: null });
          fetchContactAccounts();

          // trigger get balance of address
          apiBalance.getAddressBalance(result.contactAddrAdded, {
            force: true,
          });
        }}
        onCancel={() => {
          putScreenState({ addressToAddAsContacts: null });
        }}
      />
    </View>
  );
}

const getStyle = createGetStyles2024(() => {
  return {
    bottomDockArea: {
      bottom: 0,
      width: '100%',
      paddingHorizontal: 24,
      position: 'absolute',
      marginBottom: 56,
    },
  };
});
