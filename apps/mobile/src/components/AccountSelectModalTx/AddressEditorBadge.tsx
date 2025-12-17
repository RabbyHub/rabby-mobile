import { Text, TouchableOpacity, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { RcEditPenCC } from '@/assets/icons/send';
import { touchedFeedback } from '@/utils/touch';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useTranslation } from 'react-i18next';
import { contactService } from '@/core/services';
import { isValidHexAddress } from '@metamask/utils';
import { IS_IOS } from '@/core/native/utils';

export function AddressEditorBadge({
  style,
  account,
  onUpdatedAlias,
}: {
  account: KeyringAccountWithAlias;
  onUpdatedAlias?: (ctx: {
    account: KeyringAccountWithAlias;
    newAlias: string;
  }) => void;
} & RNViewProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const editAliasName = useAliasNameEditModal();

  const { t } = useTranslation();

  const [storedAlias, setStoredAlias] = useState('');
  const fetchAlias = useCallback(() => {
    if (isValidHexAddress(account.address as `0x${string}`)) {
      const alias = contactService.getAliasByAddress(account.address, {
        keepEmptyIfNotFound: true,
      })?.alias;
      setStoredAlias(alias || '');
    }
  }, [account.address]);
  useEffect(() => {
    fetchAlias();
  }, [fetchAlias]);

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      style={[styles.container, style]}
      onPress={() => {
        touchedFeedback();

        editAliasName.show(
          {
            ...account,
            aliasName: storedAlias || account.aliasName,
          },
          undefined,
          alias => {
            if (alias.trim().length) {
              contactService.updateAlias({
                address: account.address,
                name: alias,
              });
              fetchAlias();
              onUpdatedAlias?.({ account, newAlias: alias });
            }
          },
        );
      }}>
      <RcEditPenCC color={colors2024['brand-default']} />
      <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
        {storedAlias ||
          t('page.selectAccountSheetModal.addressEditorBadge.nameUnknown')}
      </Text>
    </TouchableOpacity>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 12,
    height: 26,
  },
  containerNoAddr: {
    minWidth: 146,
  },
  addressText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginLeft: 2,
    ...(IS_IOS && {
      position: 'relative',
      top: -2,
    }),
  },
}));
