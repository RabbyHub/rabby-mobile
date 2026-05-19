import { getErc721Approved, revokeNFTApprove } from '@/core/apis/approvals';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/src/isomorphic/address';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { useRequest } from 'ahooks';
import React from 'react';
import { RevokeApprovalCard } from './RevokeApprovalCard';
import { useRevokeApproval } from './useRevokeApproval';

interface Props {
  nft: NFTItem;
  spender: string;
  account: KeyringAccountWithAlias;
}

export const RevokeNFTBtn = ({ nft, spender, account }: Props) => {
  const { data: isApproved } = useRequest(async () => {
    const approvedToAddress = await getErc721Approved({
      chainServerId: nft.chain,
      nftTokenId: nft.inner_id,
      contractAddress: nft.contract_id,
      account,
    });

    return isSameAddress(spender, approvedToAddress);
  });

  const handleRevoke = useRevokeApproval({
    account,
    buildMiniSignTx: () =>
      revokeNFTApprove(
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
      ),
    revoke: () =>
      revokeNFTApprove({
        chainServerId: nft.chain,
        nftTokenId: nft.inner_id,
        spender: spender!,
        contractId: nft.contract_id,
        abi: 'ERC721',
        isApprovedForAll: false,
        account: account,
      }),
  });

  return (
    <RevokeApprovalCard
      disabled={!isApproved}
      onPress={handleRevoke}
      value={isApproved ? 1 : 0}
    />
  );
};
