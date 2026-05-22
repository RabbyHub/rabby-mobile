import { getNFTApprovedForAll, revokeNFTApprove } from '@/core/apis/approvals';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { NFTCollection } from '@rabby-wallet/rabby-api/dist/types';
import { useRequest } from 'ahooks';
import React from 'react';
import { RevokeApprovalCard } from './RevokeApprovalCard';
import { useRevokeApproval } from './useRevokeApproval';

interface Props {
  account: KeyringAccountWithAlias;
  collection: NFTCollection;
  spender: string;
}

export const RevokeNFTCollectionBtn = ({
  account,
  collection,
  spender,
}: Props) => {
  const { data: isApproved } = useRequest(async () => {
    return getNFTApprovedForAll({
      chainServerId: collection.chain || (collection as any).chain_id,
      contractAddress: collection.id,
      spender: spender,
      address: account.address,
      account,
    });
  });

  const handleRevoke = useRevokeApproval({
    account,
    buildMiniSignTx: () =>
      revokeNFTApprove(
        {
          chainServerId: collection.chain || (collection as any).chain_id,
          spender: spender!,
          contractId: collection.id,
          abi: 'ERC721',
          isApprovedForAll: true,
          account,
        },
        undefined,
        true,
      ),
    revoke: () =>
      revokeNFTApprove({
        chainServerId: collection.chain || (collection as any).chain_id,
        spender: spender!,
        contractId: collection.id,
        abi: 'ERC721',
        isApprovedForAll: true,
        account,
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
