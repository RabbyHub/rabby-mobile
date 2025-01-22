import { Tip } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import {
  approveToken,
  getErc721Approved,
  getErc721ApprovedForAll,
  getNFTAllowance,
  revokeNFTApprove,
} from '@/core/apis/approvals';
import { getERC20Allowance } from '@/core/apis/provider';
import { resetNavigationTo } from '@/hooks/navigation';
import { getTokenSymbol } from '@/utils/token';
import { formatTokenAmount } from '@debank/common';
import { ParsedActionData } from '@rabby-wallet/rabby-action';
import { useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';

interface Props {
  actionData: NonNullable<ParsedActionData['approveNFTCollection']>;
  address?: string;
}

export const RevokeNFTCollectionBtn = ({ actionData, address }: Props) => {
  const { t } = useTranslation();
  const { navigation } = useSafeSetNavigationOptions();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  // todo erc 1155
  const { data: isApproved } = useRequest(async () => {
    return getErc721ApprovedForAll({
      chainServerId: actionData.collection.chain,
      contractAddress: actionData.collection.id,
      spender: actionData.spender,
      address,
    });
  });

  return (
    <View style={styles.buttonContainer}>
      <Tip
        placement="top"
        content={
          !isApproved ? t('page.transactions.detail.NoApproveNeed') : undefined
        }>
        <Button
          // loading={btnLoading}
          disabled={!isApproved}
          buttonStyle={[styles.ghostButton]}
          titleStyle={[
            styles.ghostTitle,
            !isApproved && styles.ghostDisableButton,
          ]}
          onPress={async () => {
            await revokeNFTApprove({
              chainServerId: actionData.collection.chain,
              spender: actionData.spender!,
              contractId: actionData.collection.id,
              // todo erc 1155
              abi: 'ERC721',
              isApprovedForAll: true,
            });

            resetNavigationTo(navigation, 'Home');
          }}
          type={'primary'}
          title={`${t('page.transactions.detail.Revoke')}`}
        />
      </Tip>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tokenAmountText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  ghostButton: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-info'],
  },
  ghostDisableButton: {
    color: colors2024['neutral-info'],
  },
  ghostTitle: {
    color: colors2024['neutral-title-1'],
  },
  buttonContainer: {
    position: 'absolute',
    height: 60,
    bottom: 40,
    width: '100%',
    left: 16,
  },
}));
