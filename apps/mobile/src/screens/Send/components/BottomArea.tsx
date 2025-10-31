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
import { useTranslation } from 'react-i18next';

import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { Account } from '@/core/services/preference';
import { useSignatureStore } from '@/components2024/MiniSignV2';

const isAndroid = Platform.OS === 'android';

export default function BottomArea({ account }: { account: Account | null }) {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const { handleSubmit } = useSendTokenFormik();

  const {
    formValues,
    screenState,
    computed: {
      canSubmit,
      canDirectSign: canShowDirectSign,
      toAddressInContactBook,
    },
    callbacks: { handleIgnoreGasFeeChange },

    fns: { putScreenState, fetchContactAccounts },
  } = useSendTokenInternalContext();

  const { isSubmitLoading, addressToAddAsContacts } = screenState;

  const [isAllowTransferModalVisible, setIsAllowTransferModalVisible] =
    React.useState(false);

  const { safeOffBottom } = useSafeSizes();

  const { status, ctx } = useSignatureStore();

  const isDirectSigning = status === 'signing';

  const canDirectSign = !ctx?.disabledProcess;

  const showRiskTips = !!ctx?.gasFeeTooHigh;

  return (
    <View
      style={[
        styles.bottomDockArea,
        isAndroid && { paddingBottom: 20 + safeOffBottom },
      ]}>
      {canShowDirectSign ? (
        <DirectSignBtn
          // refresh  risk check
          key={screenState?.buildTxsCount + ''}
          showTextOnLoading
          loadingType="circle"
          authTitle={t('page.whitelist.confirmPassword')}
          title={t('global.confirm')}
          onFinished={p => {
            handleIgnoreGasFeeChange(p?.ignoreGasFee || false);
            handleSubmit();
          }}
          disabled={!canSubmit || !canDirectSign || isDirectSigning}
          loading={isSubmitLoading}
          type={'primary'}
          syncUnlockTime
          account={account}
          showHardWalletProcess
          showRiskTips={showRiskTips && canSubmit}
        />
      ) : (
        <Button
          disabled={!canSubmit}
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
