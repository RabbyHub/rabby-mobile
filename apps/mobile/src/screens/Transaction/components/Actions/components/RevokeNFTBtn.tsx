import { Tip } from '@/components';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import { getErc721Approved, revokeNFTApprove } from '@/core/apis/approvals';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { resetNavigationTo } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { useMiniSigner } from '@/hooks/useSigner';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { createGetStyles2024 } from '@/utils/styles';
import { isSameAddress } from '@rabby-wallet/base-utils/src/isomorphic/address';
import { NFTItem, Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

interface Props {
  nft: NFTItem;
  spender: string;
  account: KeyringAccountWithAlias;
}

export const RevokeNFTBtn = ({ nft, spender, account }: Props) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const {
    openUI,
    resetGasStore,
    close: closeMiniSign,
  } = useMiniSigner({
    account,
  });
  const { navigation } = useSafeSetNavigationOptions();

  const { data: isApproved } = useRequest(async () => {
    const approvedToAddress = await getErc721Approved({
      chainServerId: nft.chain,
      nftTokenId: nft.inner_id,
      contractAddress: nft.contract_id,
      account,
    });

    return isSameAddress(spender, approvedToAddress);
  });

  const handleRevokeDirectSign = useMemoizedFn(async () => {
    try {
      const data = await revokeNFTApprove(
        {
          chainServerId: nft.chain,
          nftTokenId: nft.inner_id,
          spender: spender!,
          contractId: nft.contract_id,
          abi: 'ERC721',
          isApprovedForAll: false,
          account: account,
        },
        undefined,
        true,
      );
      const tx = data.params[0] as Tx;
      closeMiniSign();
      resetGasStore();
      const res = await openUI({
        txs: [tx],
      });
    } catch (e) {
      console.error(e);
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      resetNavigationTo(navigation, 'Home');
    }
  });

  const handleRevoke = useMemoizedFn(async () => {
    try {
      if (isAccountSupportMiniApproval(account.type)) {
        await handleRevokeDirectSign();
        return;
      }

      await revokeNFTApprove({
        chainServerId: nft.chain,
        nftTokenId: nft.inner_id,
        spender: spender!,
        contractId: nft.contract_id,
        abi: 'ERC721',
        isApprovedForAll: false,
        account: account,
      });
    } catch (e) {
      console.error(e);
    }

    resetNavigationTo(navigation, 'Home');
  });

  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.label}>
          {t('page.transactions.detail.totalApprovedAmount')}
        </Text>
        <Text style={styles.value}>{isApproved ? 1 : 0}</Text>
      </View>
      <View style={styles.buttonContainer}>
        <Tip
          placement="top"
          pressableProps={{
            onPress(ctx) {
              ctx.turnOn();
              if (timerRef.current) {
                clearTimeout(timerRef.current);
              }
              timerRef.current = setTimeout(() => {
                ctx.turnOff();
              }, 3000);
            },
          }}
          content={
            !isApproved
              ? t('page.transactions.detail.NoApproveNeed')
              : undefined
          }>
          <Button
            // loading={btnLoading}
            disabled={!isApproved}
            buttonStyle={[styles.ghostButton]}
            titleStyle={[
              styles.ghostTitle,
              !isApproved && styles.ghostDisableButton,
            ]}
            onPress={handleRevoke}
            type={'primary'}
            title={`${t('page.transactions.detail.Revoke')}`}
          />
        </Tip>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    marginTop: 12,
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    marginRight: 'auto',
  },

  value: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },

  ghostButton: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-disable'],
  },
  ghostDisableButton: {
    color: colors2024['brand-disable'],
  },
  ghostTitle: {
    color: colors2024['brand-default'],
  },
  buttonContainer: {},
}));
