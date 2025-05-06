import { useEffect } from 'react';
import { isValidHexAddress, Hex } from '@metamask/utils';
import { useTranslation } from 'react-i18next';
import { useWhitelist } from '@/hooks/whitelist';
import { Alert } from 'react-native';
import { contactService } from '@/core/services';

export const useAlert = (address: string, onConfirm: () => void) => {
  const { t } = useTranslation();
  const { isAddrOnWhitelist } = useWhitelist({
    disableAutoFetch: false,
  });
  useEffect(() => {
    if (address && isValidHexAddress(address as Hex)) {
      if (isAddrOnWhitelist(address)) {
        const aliasName =
          contactService.getAliasByAddress(address)?.alias || '';
        Alert.alert(
          t('page.whitelist.alreadyInYour'),
          `${address}` + (aliasName ? ` (${aliasName})` : ''),
          [{ text: t('global.ok'), onPress: onConfirm }],
        );
      }
    }
  }, [address, isAddrOnWhitelist, onConfirm, t]);
};
