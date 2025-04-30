import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from 'react-native-switch';
import { noop } from 'lodash';

import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import AddressPopover from '../AddressPopover';
import AddressSource from '../AddressSourceCard';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useWhitelist } from '@/hooks/whitelist';
import { useRisks } from './risk';
import { toast } from '@/components2024/Toast';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import {
  AddrDescResponse,
  ProjectItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { Skeleton } from '@rneui/themed';
import { matomoRequestEvent } from '@/utils/analytics';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { RcIconWarningCircleCC } from '@/assets2024/icons/common';
export interface ConfirmAddressScreenProps {
  title?: string;
  disbaleWhiteSwitch?: boolean;
  cex?: ProjectItem;
  account: KeyringAccountWithAlias;
  onConfirm?: (
    account: KeyringAccountWithAlias,
    addressDesc?: AddrDescResponse['desc'],
  ) => void;
  onCancel?: () => void;
}
const ConfirmAddress = ({
  account,
  onCancel,
  onConfirm,
  title,
  cex,
  disbaleWhiteSwitch,
}: ConfirmAddressScreenProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { isAddrOnWhitelist, addWhitelist, removeWhitelist } = useWhitelist();
  const switchRef = useRef<Switch>(null);
  const { loading, risks, addressDesc } = useRisks(
    account.address,
    !!account.balance,
    cex,
  );
  const [isChecked, setIsChecked] = useState(false);
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const { safeSizes } = useSafeAndroidBottomSizes({
    footerButtonGroupMb: 35,
  });

  const inWhiteList = useMemo(
    () => isAddrOnWhitelist(account.address),
    [account.address, isAddrOnWhitelist],
  );
  useEffect(() => {
    if (switchRef.current) {
      switchRef.current.setState({ value: inWhiteList });
    }
  }, [inWhiteList]);

  const setInWhitelist = useCallback(
    (bool: boolean) => {
      if (bool) {
        const isImported = accounts.some(i =>
          isSameAddress(i.address, account.address),
        );
        matomoRequestEvent({
          category: 'Send Usage',
          action: isImported
            ? 'Send_AddWhitelist_imported'
            : 'Send_AddWhitelist_notImported',
        });
        addWhitelist(account.address, {
          onAdded: () => {
            toast.success(t('page.whitelist.addSuccessful'));
          },
        });
      } else {
        removeWhitelist(account.address);
      }
    },
    [account.address, addWhitelist, removeWhitelist, t, accounts],
  );

  const handleConfirm = () => {
    onConfirm?.(account, addressDesc);
  };
  return (
    <View
      style={[
        styles.screen,
        loading && {
          minHeight: disbaleWhiteSwitch ? 464 : 515,
        },
      ]}>
      <Text style={styles.modalTitle}>
        {title || t('page.confirmAddress.sendTo')}
      </Text>
      <AddressPopover
        loading={loading}
        address={account.address}
        style={styles.addressPopover}
      />
      <AddressSource
        loading={loading}
        addressDesc={addressDesc}
        account={account}
        style={styles.addressCard}
      />
      {!loading && !disbaleWhiteSwitch && (
        <View style={styles.whitelist}>
          <Text style={styles.text}>{t('page.whitelist.addToWhitelist')}</Text>
          <AppSwitch2024
            ref={switchRef}
            onValueChange={setInWhitelist}
            value={inWhiteList}
          />
        </View>
      )}
      <View
        style={[
          styles.riskList,
          loading && {
            marginTop: disbaleWhiteSwitch ? 41 : 92,
            marginBottom: 123,
          },
        ]}>
        {loading ? (
          <Skeleton style={styles.loading} height={52} />
        ) : (
          risks.map(risk => (
            <View key={risk.type} style={styles.tipItem}>
              <RcIconWarningCircleCC
                width={20}
                height={20}
                color={colors2024['orange-default']}
              />
              <Text style={styles.tipText}>{risk.value}</Text>
            </View>
          ))
        )}
      </View>
      {!loading && risks?.length ? (
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => {
            setIsChecked(prev => !prev);
          }}>
          <CheckBoxRect size={16} checked={isChecked} />
          <Text style={styles.checkboxText}>
            {t('page.confirmAddress.checkbox')}
          </Text>
        </TouchableOpacity>
      ) : null}
      {!loading && (
        <FooterButtonGroup
          style={StyleSheet.flatten([
            styles.footerButtonGroup,
            { marginBottom: safeSizes.footerButtonGroupMb },
          ])}
          authButton
          onCancel={onCancel ?? noop}
          onConfirm={handleConfirm}
          confirmDisabled={risks.length > 0 && !isChecked}
        />
      )}
    </View>
  );
};

export default ConfirmAddress;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  modalTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    paddingTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  addressPopover: {
    marginTop: 10,
  },
  screen: {
    paddingHorizontal: 20,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  loadingScreen: {
    minHeight: 515,
  },
  whitelist: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  addressCard: {
    borderWidth: 1,
    height: 78,
    width: '100%',
  },
  riskList: {
    marginTop: 34,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 32,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors2024['neutral-bg-5'],
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 12,
  },
  tipIcon: {
    width: 14,
    justifyContent: 'center',
    height: 20,
  },
  tipText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  footerButtonGroup: {
    paddingTop: 0,
    paddingHorizontal: 4,
    // ...makeDebugBorder('yellow'),
  },
  loadingList: {
    marginTop: 92,
    marginBottom: 123,
  },
  loading: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 8,
    flex: 1,
  },
  checkbox: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkboxText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
}));
