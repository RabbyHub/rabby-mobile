import {
  KeyringAccountWithAlias,
  useAccounts,
  usePinAddresses,
} from '@/hooks/account';
import React, { useCallback } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressItemInner2024 } from '@/screens/Address/components/AddressItemInner2024';
import EditSVG from '@/assets2024/icons/common/edit-cc.svg';
import DeleteSVG from '@/assets2024/icons/common/delete-cc.svg';
import MoreSVG from '@/assets2024/icons/common/more-cc.svg';
import { useDeleteAccountModal } from '@/screens/Address/useDeleteAccountModal';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useAliasNameEditModal } from '../AliasNameEditModal/useAliasNameEditModal';
import { useAddressDetailModal } from '@/screens/Address/useAddressDetailModal';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { WalletPin } from '../AddressItem/AddressItem';
import { useTranslation } from 'react-i18next';
import { OtherAddressNav } from '@/screens/Address/components/OtherAddressNav';
import { Card } from '@/components2024/Card';
import PlusSVG from '@/assets2024/icons/common/plus-cc.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '../GlobalBottomSheetModal';
import { MODAL_NAMES } from '../GlobalBottomSheetModal/types';
import { toast } from '../Toast';

export interface Props {
  type: 'address' | 'watch-address' | 'safe-address';
  onAddAddress?: () => void;
  onCancel: () => void;
}

const maxHeight = Dimensions.get('window').height - 104;

// eslint-disable-next-line react-native/no-inline-styles
const ItemSeparatorComponent = () => <View style={{ height: 12 }} />;

const ItemFooterComponent = () => {
  // eslint-disable-next-line react-native/no-inline-styles
  return <View style={{ height: 56 }} />;
};

export const AddressQuickManager: React.FC<Props> = ({
  type,
  onCancel,
  onAddAddress,
}) => {
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  // const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const accountList = React.useMemo(() => {
    if (type === 'address') {
      return accounts.filter(
        account =>
          account.type !== KEYRING_TYPE.WatchAddressKeyring &&
          account.type !== KEYRING_TYPE.GnosisKeyring,
      );
    } else if (type === 'watch-address') {
      return accounts.filter(
        account => account.type === KEYRING_TYPE.WatchAddressKeyring,
      );
    } else if (type === 'safe-address') {
      return accounts.filter(
        account => account.type === KEYRING_TYPE.GnosisKeyring,
      );
    }

    return [];
  }, [accounts, type]);
  const removeAccount = useDeleteAccountModal();
  const editAliasName = useAliasNameEditModal();
  const showAddressDetail = useAddressDetailModal();
  const list = useSortAddressList(accountList);
  const { pinAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });
  const isPinned = useCallback(
    (account: KeyringAccountWithAlias) =>
      pinAddresses.some(
        e =>
          isSameAddress(e.address, account.address) &&
          e.brandName === account.brandName,
      ),
    [pinAddresses],
  );
  const hasWatchAddress = React.useMemo(() => {
    return accounts.some(account => account.type === KEYRING_CLASS.WATCH);
  }, [accounts]);
  const hasSafeAddress = React.useMemo(() => {
    return accounts.some(account => account.type === KEYRING_CLASS.GNOSIS);
  }, [accounts]);
  const onGotoWatchAddress = React.useCallback(() => {
    const watchLength = accounts.filter(
      account => account.type === KEYRING_TYPE.WatchAddressKeyring,
    ).length;
    const contentHeight = (watchLength || 0) * (78 + 12) + 60 + 56;
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADDRESS_QUICK_MANAGER,
      bottomSheetModalProps: {
        snapPoints: [Math.min(contentHeight, maxHeight)],
      },
      type: 'watch-address',
      onCancel: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
  }, [accounts]);
  // const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();

  const onGotoSafeAddress = React.useCallback(() => {
    const safeLength = accounts.filter(
      account => account.type === KEYRING_TYPE.GnosisKeyring,
    ).length;
    const contentHeight = (safeLength || 0) * (78 + 12) + 60 + 56;
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADDRESS_QUICK_MANAGER,
      bottomSheetModalProps: {
        snapPoints: [Math.min(contentHeight, maxHeight)],
      },
      type: 'safe-address',
      onCancel: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
  }, [accounts]);

  return (
    <View>
      <View style={styles.titleTextWrapper}>
        <Text style={styles.titleText}>
          {t('page.manageAddress.quickAddressTitle', { count: list.length })}
        </Text>
      </View>
      <BottomSheetFlatList
        style={styles.list}
        data={list}
        keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListFooterComponent={
          type === 'address' ? (
            <View style={styles.footer}>
              <Card style={styles.footerCard} onPress={onAddAddress}>
                <View style={styles.footerMain}>
                  <PlusSVG
                    width={20}
                    height={20}
                    color={colors2024['neutral-secondary']}
                  />
                  <Text style={styles.footerCardText}>
                    {t('page.addressDetail.addressListScreen.addAddress')}
                  </Text>
                </View>
              </Card>
              {hasSafeAddress && (
                <OtherAddressNav
                  onPress={onGotoSafeAddress}
                  text={t(
                    'page.addressDetail.addressListScreen.importSafeAddress',
                  )}
                />
              )}
              {hasWatchAddress && (
                <OtherAddressNav
                  onPress={onGotoWatchAddress}
                  text={t(
                    'page.addressDetail.addressListScreen.importWatchAddress',
                  )}
                />
              )}
              <View style={styles.footerGap} />
            </View>
          ) : (
            ItemFooterComponent
          )
        }
        renderItem={({ item: account }) => (
          <View style={styles.addressItem} key={account.type + account.address}>
            <View style={styles.itemLeft}>
              <TouchableOpacity
                hitSlop={10}
                onPress={() => {
                  removeAccount({
                    account,
                    onFinished: () => {
                      toast.success(t('global.Deleted'));
                    },
                  });
                }}>
                <DeleteSVG />
              </TouchableOpacity>
              <AddressItemInner2024
                style={styles.card}
                account={account}
                hiddenPin
                hiddenArrow
              />
            </View>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                onPress={() => {
                  editAliasName.show(account);
                }}
                hitSlop={10}
                style={styles.button}>
                <EditSVG
                  color={colors2024['neutral-body']}
                  width={20}
                  height={20}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  showAddressDetail({ account, onCancel });
                }}
                hitSlop={10}
                style={styles.button}>
                <MoreSVG
                  color={colors2024['neutral-body']}
                  width={20}
                  height={20}
                />
              </TouchableOpacity>
            </View>
            {isPinned(account) ? <WalletPin /> : null}
          </View>
        )}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  list: {
    padding: 16,
    marginBottom: 56,
  },
  addressItem: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    height: 78,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flex: 1,
  },
  card: {
    padding: 0,
    marginLeft: 12,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 5,
    borderRadius: 30,
  },
  titleTextWrapper: {
    // flex: 1,
    paddingBottom: 10,
    paddingTop: 20,
  },
  footerCard: {
    backgroundColor: colors2024['neutral-bg-2'],
    marginBottom: 22,
    padding: 16,
    borderRadius: 20,
  },
  footerMain: {
    height: 46,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerCardText: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    height: 200,
    marginTop: 12,
  },
  footerGap: {
    height: 70,
  },
}));
