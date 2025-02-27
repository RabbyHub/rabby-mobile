import { Tip } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useRef } from 'react';
import { Text, View } from 'react-native';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import {
  approveToken,
  getErc721Approved,
  getNFTAllowance,
  revokeNFTApprove,
} from '@/core/apis/approvals';
import { getERC20Allowance } from '@/core/apis/provider';
import { resetNavigationTo } from '@/hooks/navigation';
import { getTokenSymbol } from '@/utils/token';
import { formatTokenAmount } from '@debank/common';
import { ParsedActionData } from '@rabby-wallet/rabby-action';
import { useMemoizedFn, useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { A } from 'ts-toolbelt';
import { isSameAddress } from '@rabby-wallet/base-utils/src/isomorphic/address';
import { getAddress } from 'viem';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { KeyringAccountWithAlias } from '@/hooks/account';

interface Props {
  nft: NFTItem;
  spender: string;
  account: KeyringAccountWithAlias;
}

export const RevokeNFTBtn = ({ nft, spender, account }: Props) => {
  const { t } = useTranslation();
  const { navigation } = useSafeSetNavigationOptions();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { switchSceneSigningAccount } = useSwitchSceneCurrentAccount();

  const { data: isApproved } = useRequest(async () => {
    const approvedToAddress = await getErc721Approved({
      chainServerId: nft.chain,
      nftTokenId: nft.inner_id,
      contractAddress: nft.contract_id,
    });

    return isSameAddress(spender, approvedToAddress);
  });

  const handleRevoke = useMemoizedFn(async () => {
    await switchSceneSigningAccount('MultiHistory', account);
    try {
      await revokeNFTApprove({
        chainServerId: nft.chain,
        nftTokenId: nft.inner_id,
        spender: spender!,
        contractId: nft.contract_id,
        abi: 'ERC721',
        isApprovedForAll: false,
      });
    } catch (e) {
      console.error(e);
    } finally {
      await switchSceneSigningAccount('MultiHistory', null);
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
