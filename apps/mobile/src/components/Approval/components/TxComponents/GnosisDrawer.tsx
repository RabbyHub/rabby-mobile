import { Button } from '@/components/Button';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { AppColorsVariants } from '@/constant/theme';
import { apisSafe } from '@/core/apis/safe';
import {
  KeyringAccountWithAlias as Account,
  useAccounts,
} from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { BasicSafeInfo, SafeMessage } from '@rabby-wallet/gnosis-sdk';
import { useMemoizedFn } from 'ahooks';
import { groupBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddressItem, ownerPriority } from './DrawerAddressItem';

interface GnosisDrawerProps {
  safeInfo: BasicSafeInfo;
  onCancel(): void;
  onConfirm(account: Account, isNew?: boolean): Promise<void>;
  visible?: boolean;
  confirmations?: SafeMessage['confirmations'];
}

interface Signature {
  data: string;
  signer: string;
}

export const GnosisDrawer = ({
  safeInfo,
  onCancel,
  onConfirm,
  visible,
  confirmations,
}: GnosisDrawerProps) => {
  const { t } = useTranslation();
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [ownerAccounts, setOwnerAccounts] = useState<Account[]>([]);
  const [checkedAccount, setCheckedAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const sortOwners = async () => {
    const owners = safeInfo.owners;
    const ownersInWallet = accounts.filter(account =>
      owners.find(owner => isSameAddress(account.address, owner)),
    );
    const groupOwners = groupBy(ownersInWallet, item =>
      item.address.toLowerCase(),
    );
    const result = Object.keys(groupOwners).map(address => {
      let target = groupOwners?.[address]?.[0];
      if (groupOwners?.[address]?.length === 1) {
        return target;
      }
      for (let i = 0; i < ownerPriority.length; i++) {
        const tmp = groupOwners?.[address]?.find(
          account => account.type === ownerPriority[i],
        );
        if (tmp) {
          target = tmp;
          break;
        }
      }
      return target;
    });
    const notInWalletOwners = owners.filter(
      owner => !result.find(item => isSameAddress(item?.address || '', owner)),
    );
    setOwnerAccounts([
      ...result,
      ...notInWalletOwners.map(
        owner =>
          ({
            address: owner,
            type: '',
            brandName: '',
          } as any),
      ),
    ]);
  };

  const handleSelectAccount = (account: Account) => {
    setCheckedAccount(account);
  };

  const isSignedAccount = React.useCallback(
    (account?: Account | null) => {
      if (!account) {
        return false;
      }

      return signatures.some(sig => isSameAddress(sig.signer, account.address));
    },
    [signatures],
  );

  const canConfirm =
    !!checkedAccount?.type && !isSignedAccount(checkedAccount) && !isLoading;

  const handleConfirm = async () => {
    if (!canConfirm || !checkedAccount) {
      return;
    }

    try {
      setIsLoading(true);
      await onConfirm(checkedAccount, signatures.length <= 0);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const init = useMemoizedFn(async () => {
    sortOwners();
  });

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (confirmations) {
      setSignatures(
        confirmations.map(item => {
          return {
            signer: item.owner,
            data: item.signature,
          };
        }),
      );
    } else {
      apisSafe.getGnosisTransactionSignatures().then(setSignatures);
    }
  }, [confirmations]);

  useEffect(() => {
    if (
      checkedAccount &&
      (!checkedAccount.type || isSignedAccount(checkedAccount))
    ) {
      setCheckedAccount(null);
    }
  }, [checkedAccount, isSignedAccount]);

  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const { bottom } = useSafeAreaInsets();

  React.useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={() => onCancel?.()}
      snapPoints={[440]}>
      <View
        style={[
          styles.gnosisDrawerContainer,
          {
            paddingBottom: bottom || 20,
          },
        ]}>
        <Text style={styles.title}>
          {safeInfo.threshold - signatures.length > 0
            ? t('page.signTx.moreSafeSigNeeded', {
                0: safeInfo.threshold - signatures.length,
              })
            : t('page.signTx.enoughSafeSigCollected')}
        </Text>
        <BottomSheetFlatList
          data={ownerAccounts}
          keyExtractor={item =>
            `${item.address}-${item.type}-${item.brandName}`
          }
          renderItem={item => {
            const owner = item.item;
            const ownerSigned = isSignedAccount(owner);
            return (
              <AddressItem
                key={owner.address}
                account={owner}
                signed={ownerSigned}
                onSelect={handleSelectAccount}
                checked={
                  checkedAccount
                    ? !ownerSigned &&
                      isSameAddress(owner.address, checkedAccount.address)
                    : false
                }
              />
            );
          }}
          style={styles.list}
        />
        <View style={styles.footer}>
          <Button
            onPress={onCancel}
            title={t('global.backButton')}
            containerStyle={styles.buttonContainer}
          />
          <Button
            onPress={handleConfirm}
            disabled={!canConfirm}
            title={
              isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                t('global.proceedButton')
              )
            }
            containerStyle={styles.buttonContainer}
          />
        </View>
      </View>
    </AppBottomSheetModal>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    gnosisDrawerContainer: {
      height: '100%',
    },
    title: {
      marginBottom: 20,
      fontWeight: '500',
      fontSize: 20,
      lineHeight: 23,
      textAlign: 'center',
      color: colors['neutral-title-1'],
    },
    list: {
      flex: 1,
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 16,
      alignItems: 'center',
    },
    buttonContainer: {
      flex: 1,
    },
  });
