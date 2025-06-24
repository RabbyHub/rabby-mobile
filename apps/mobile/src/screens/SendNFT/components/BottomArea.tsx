import React from 'react';
import { Platform, View } from 'react-native';
import { Button } from '@/components';
import {
  useSendNFTFormik,
  useSendNFTInternalContext,
} from '../hooks/useSendNFT';
import { useTranslation } from 'react-i18next';

import { ModalConfirmAllowTransfer } from '@/components/Address/SheetModalConfirmAllowTransfer';
import { ModalAddToContacts } from '@/components/Address/SheetModalAddToContacts';
import { apiBalance } from '@/core/apis';
import { useSafeSizes } from '@/hooks/useAppLayout';
import AuthButton from '@/components2024/AuthButton';
import { useTheme2024 } from '@/hooks/theme';
import {
  directSigningAtom,
  useCanProcessDirectSubmit,
} from '@/hooks/useMiniApprovalDirectSign';
import { useAtom } from 'jotai';
import { createGetStyles2024 } from '@/utils/styles';

const isAndroid = Platform.OS === 'android';

export default function BottomArea() {
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle: getStyles });

  const { handleSubmit } = useSendNFTFormik();

  const {
    formValues,
    screenState,
    computed: {
      canSubmit,
      canDirectSign: canShowDirectSign,
      toAddressInContactBook,
    },
    fns: { putScreenState, fetchContactAccounts },
  } = useSendNFTInternalContext();

  const { isSubmitLoading, addressToAddAsContacts } = screenState;

  const [isAllowTransferModalVisible, setIsAllowTransferModalVisible] =
    React.useState(false);

  const { safeOffBottom } = useSafeSizes();

  const [isDirectSigning] = useAtom(directSigningAtom);

  const canDirectSign = useCanProcessDirectSubmit();

  return (
    <View
      style={[
        styles.bottomDockArea,
        isAndroid && { paddingBottom: 20 + safeOffBottom },
      ]}>
      {canShowDirectSign ? (
        <AuthButton
          authTitle={t('page.whitelist.confirmPassword')}
          title={t('global.confirm')}
          onFinished={handleSubmit}
          disabled={!canSubmit || !canDirectSign || isDirectSigning}
          type={'primary'}
          syncUnlockTime
        />
      ) : (
        <Button
          disabled={!canSubmit}
          containerStyle={styles.buttonContainer}
          titleStyle={styles.buttonText}
          type="primary"
          title={'Send'}
          loading={isSubmitLoading}
          onPress={handleSubmit}
        />
      )}

      <ModalConfirmAllowTransfer
        toAddr={formValues.to}
        visible={isAllowTransferModalVisible}
        showAddToWhitelist={toAddressInContactBook}
        onFinished={result => {
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

const getStyles = createGetStyles2024(({ colors2024 }) => {
  return {
    bottomDockArea: {
      bottom: 0,
      width: '100%',
      padding: 24,
      paddingBottom: 56,
      backgroundColor: colors2024['neutral-bg-1'],
      position: 'absolute',
    },

    buttonContainer: {
      width: '100%',
      height: 52,
      borderRadius: 6,
      ...(!isAndroid && {
        marginBottom: 16,
      }),
    },

    buttonText: {
      color: colors2024['neutral-title-2'],
    },
  };
});
