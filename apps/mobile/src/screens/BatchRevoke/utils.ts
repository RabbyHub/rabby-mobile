import { approvalUtils } from '@rabby-wallet/biz-utils';
import { NFTApproval, Spender } from '@rabby-wallet/rabby-api/dist/types';
import { getAbiType } from '../Approvals/utils';
import { urlUtils } from '@rabby-wallet/base-utils';

const { obj2query, query2obj } = urlUtils;
type ApprovalItem = approvalUtils.ApprovalItem;
type ApprovalSpenderItemToBeRevoked =
  approvalUtils.ApprovalSpenderItemToBeRevoked;
type ContractApprovalItem = approvalUtils.ContractApprovalItem;
type AssetApprovalSpender = approvalUtils.AssetApprovalSpender;

export function getFirstSpender(spenderHost: ApprovalItem['list'][number]) {
  if ('spender' in spenderHost) return spenderHost.spender;

  if ('spenders' in spenderHost) return spenderHost.spenders[0];

  return undefined;
}

type SpendersHost = ApprovalItem['list'][number];

export const findIndexRevokeList = <
  T extends SpendersHost = ApprovalItem['list'][number],
>(
  list: ApprovalSpenderItemToBeRevoked[],
  input: {
    spenderHost: T;
  } & (
    | {
        item: ContractApprovalItem;
        itemIsContractApproval?: true;
      }
    | {
        item: Exclude<ApprovalItem, ContractApprovalItem>;
        assetApprovalSpender?: AssetApprovalSpender;
      }
  ),
) => {
  const { item, spenderHost } = input;

  if (item.type === 'contract') {
    let assetApprovalSpender =
      'assetApprovalSpender' in input
        ? input.assetApprovalSpender ?? null
        : null;
    const itemIsContractApproval =
      'itemIsContractApproval' in input ? input.itemIsContractApproval : false;
    if (itemIsContractApproval && '$indexderSpender' in spenderHost) {
      assetApprovalSpender = spenderHost.$indexderSpender ?? null;
    }
    const permit2IdToMatch = assetApprovalSpender?.permit2_id;

    if ('inner_id' in spenderHost) {
      return list.findIndex(revoke => {
        if (
          revoke.contractId === spenderHost.contract_id &&
          revoke.spender === spenderHost.spender.id &&
          revoke.abi === getAbiType(spenderHost) &&
          (permit2IdToMatch
            ? revoke.permit2Id === permit2IdToMatch
            : !revoke.permit2Id) &&
          revoke.nftTokenId === spenderHost.inner_id &&
          revoke.chainServerId === spenderHost.chain
        ) {
          return true;
        }
      });
    } else if ('contract_name' in spenderHost) {
      return list.findIndex(revoke => {
        if (
          revoke.contractId === spenderHost.contract_id &&
          revoke.spender === spenderHost.spender.id &&
          revoke.abi === getAbiType(spenderHost) &&
          revoke.nftContractName === spenderHost.contract_name &&
          (permit2IdToMatch
            ? revoke.permit2Id === permit2IdToMatch
            : !revoke.permit2Id) &&
          revoke.chainServerId === spenderHost.chain
        ) {
          return true;
        }
      });
    } else {
      return list.findIndex(revoke => {
        if (
          revoke.spender === item.id &&
          (permit2IdToMatch
            ? revoke.permit2Id === permit2IdToMatch
            : !revoke.permit2Id) &&
          revoke.tokenId === spenderHost.id &&
          revoke.chainServerId === item.chain
        ) {
          return true;
        }
      });
    }
  } else if (item.type === 'token') {
    return list.findIndex(revoke => {
      if (
        revoke.spender === (spenderHost as Spender).id &&
        // revoke.id === item.id &&
        revoke.tokenId === item.id &&
        revoke.chainServerId === item.chain
      ) {
        return true;
      }
    });
  } else if (item.type === 'nft') {
    return list.findIndex(revoke => {
      const isNftContracts = !!item.nftContract;
      const nftInfo = isNftContracts ? item.nftContract : item.nftToken;

      if (
        revoke.spender === (spenderHost as Spender).id &&
        revoke.tokenId === (nftInfo as NFTApproval).inner_id &&
        revoke.chainServerId === item.chain
      ) {
        return true;
      }
    });
  }
  return -1;
};

export function isSameRevokeItem(
  src: ApprovalSpenderItemToBeRevoked,
  target: ApprovalSpenderItemToBeRevoked,
) {
  const base =
    src.approvalType === target.approvalType &&
    src.contractId === target.contractId &&
    src.spender === target.spender &&
    src.permit2Id === target.permit2Id &&
    src.spender === target.spender;

  if (!base) return false;

  if ('id' in src && 'id' in target) {
    return src.id === target.id && src.tokenId === target.tokenId;
  } else if ('nftTokenId' in src && 'nftTokenId' in target) {
    return (
      src.contractId === target.contractId &&
      src.isApprovedForAll === target.isApprovedForAll &&
      src.tokenId === target.tokenId &&
      src.abi === target.abi &&
      src.nftTokenId === target.nftTokenId &&
      src.nftContractName === target.nftContractName
    );
  }
}

export function encodeRevokeItem(item: ApprovalSpenderItemToBeRevoked) {
  return `revoke-item://?${obj2query(item as any)}`;
}

export function decodeRevokeItem(key: string) {
  const [, query] = key.split('?');
  const obj = query2obj(query) as any as ApprovalSpenderItemToBeRevoked;

  for (const objKey in obj) {
    if (obj[objKey] === 'null') {
      obj[objKey] = null;
    } else if (obj[objKey] === 'undefined') {
      obj[objKey] = undefined;
    } else if (obj[objKey] === 'true') {
      obj[objKey] = true;
    } else if (obj[objKey] === 'false') {
      obj[objKey] = false;
    }
  }

  return obj;
}
