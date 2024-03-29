import dayjs from 'dayjs';

import {
  ApprovalItem,
  ApprovalSpenderItemToBeRevoked,
  ContractApprovalItem,
  RiskNumMap,
  SpenderInNFTApproval,
} from '@rabby-wallet/biz-utils/dist/isomorphic/approval';

import {
  NFTApproval,
  NFTApprovalContract,
  Spender,
  TokenApproval,
} from '@rabby-wallet/rabby-api/dist/types';
import { Chain } from '@debank/common';
import { getAddressScanLink } from '@/utils/address';
import { openExternalUrl } from '@/core/utils/linking';
import { urlUtils } from '@rabby-wallet/base-utils';
import { approvalUtils } from '@rabby-wallet/biz-utils';

export function formatTimeFromNow(time?: Date | number) {
  if (!time) return '';

  const obj = dayjs(time);
  if (!obj.isValid()) return '';

  dayjs.updateLocale('en', {
    relativeTime: {
      future: 'in %s',
      past: '%s ago',
      s: 'a few seconds',
      m: '1 minute',
      mm: '%d minutes',
      h: '1 hour',
      hh: '%d hours',
      d: '1 day',
      dd: '%d days',
      M: '1 month',
      MM: '%d months',
      y: '1 year',
      yy: '%d years',
    },
  });

  return dayjs(time).fromNow();
}

export function isRiskyContract(contract: ContractApprovalItem) {
  return ['danger', 'warning'].includes(contract.risk_level);
}

export function encodeRevokeItemIndex(approval: ApprovalItem) {
  return `${approval.chain}:${approval.id}`;
}

export function parseContractApprovalListItem(
  spender: ContractApprovalItem['list'][number],
) {
  // NFTApproval | NFTApprovalContract | TokenApproval
  const id =
    (spender as NFTApproval | TokenApproval).id ||
    (spender as NFTApprovalContract).spender.id;

  return {
    id,
    chain: spender.chain,
  };
}

export function encodeApprovalKey(approvalItem: ApprovalItem) {
  switch (approvalItem.type) {
    // default: {
    //   return `${approvalItem.chain}:${approvalItem.id}`;
    // }
    case 'token':
    case 'nft':
    case 'contract': {
      return `${approvalItem.type}:${approvalItem.chain}:${approvalItem.id}`;
    }
  }
}

export function encodeApprovalSpenderKey<
  T extends ApprovalItem['list'][number] = ApprovalItem['list'][number],
>(approval: ApprovalItem, token: T) {
  if (approval.type === 'contract') {
    if ('inner_id' in token) {
      return `approval://contract-token/?${urlUtils.obj2query({
        spender: token.spender.id,
        chainServerId: token.chain,
        contractId: token.contract_id,
        tokenId: token.inner_id,
      })}`;
    } else if ('contract_name' in token) {
      return `approval://contract/?${urlUtils.obj2query({
        spender: token.spender.id,
        chainServerId: token.chain,
        tokenContractId: token.contract_id,
      })}`;
    } else {
      return `approval://contract/?${urlUtils.obj2query({
        spender: approval.id,
        chainServerId: approval.chain,
        tokenId: token.id,
      })}`;
    }
  } else if (approval.type === 'token') {
    return `approval://token/?${urlUtils.obj2query({
      spender: (token as Spender).id,
      chainServerId: approval.chain,
      approvalId: approval.id,
    })}`;
  } else if (approval.type === 'nft') {
    const isNftContracts = !!approval.nftContract;
    const nftInfo = isNftContracts ? approval.nftContract : approval.nftToken;

    return `approval://nft/?${urlUtils.obj2query({
      spender: (token as Spender).id,
      chainServerId: approval.chain,
      tokenId: (nftInfo as NFTApproval).inner_id,
    })}`;
  }
}

export function matchAssetApprovalSpender(
  assetRevokeMap: Record<string, ApprovalSpenderItemToBeRevoked>,
  spender?: approvalUtils.AssetApprovalSpender | null,
) {
  if (!spender) return null;
  const key = encodeApprovalSpenderKey(
    spender.$assetContract!,
    spender.$assetToken!,
  );
  return key && assetRevokeMap[key];
}

export const findIndexRevokeList = <
  T extends ApprovalItem['list'][number] = ApprovalItem['list'][number],
>(
  list: any[],
  item: ApprovalItem,
  token: T,
) => {
  if (item.type === 'contract') {
    if ('inner_id' in token) {
      return list.findIndex(revoke => {
        if (
          revoke.contractId === token.contract_id &&
          revoke.spender === token.spender.id &&
          revoke.tokenId === token.inner_id &&
          revoke.chainServerId === token.chain
        ) {
          return true;
        }
      });
    } else if ('contract_name' in token) {
      return list.findIndex(revoke => {
        if (
          revoke.contractId === token.contract_id &&
          revoke.spender === token.spender.id &&
          revoke.chainServerId === token.chain
        ) {
          return true;
        }
      });
    } else {
      return list.findIndex(revoke => {
        if (
          revoke.spender === item.id &&
          revoke.id === token.id &&
          revoke.chainServerId === item.chain
        ) {
          return true;
        }
      });
    }
  } else if (item.type === 'token') {
    return list.findIndex(revoke => {
      if (
        revoke.spender === (token as Spender).id &&
        revoke.id === item.id &&
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
        revoke.spender === (token as Spender).id &&
        revoke.tokenId === (nftInfo as NFTApproval).inner_id &&
        revoke.chainServerId === item.chain
      ) {
        return true;
      }
    });
  }
  return -1;
};

export const toRevokeItem = <T extends ApprovalItem>(
  item: T,
  token: T['list'][number],
): ApprovalSpenderItemToBeRevoked | undefined => {
  if (item.type === 'contract') {
    if ('inner_id' in token) {
      const abi = token?.is_erc721
        ? 'ERC721'
        : token?.is_erc1155
        ? 'ERC1155'
        : '';
      return {
        chainServerId: token?.chain,
        contractId: token?.contract_id,
        spender: token?.spender?.id,
        abi,
        tokenId: token?.inner_id,
        isApprovedForAll: false,
      } as const;
    } else if ('contract_name' in token) {
      const abi = token?.is_erc721
        ? 'ERC721'
        : token?.is_erc1155
        ? 'ERC1155'
        : '';
      return {
        chainServerId: token?.chain,
        contractId: token?.contract_id,
        spender: token?.spender?.id,
        tokenId: null,
        abi,
        isApprovedForAll: true,
      } as const;
    } else {
      return {
        chainServerId: item.chain,
        id: token?.id,
        spender: item.id,
      };
    }
  }

  if (item.type === 'token') {
    return {
      chainServerId: item.chain,
      id: item.id,
      spender: (token as Spender).id,
    };
  }

  if (item.type === 'nft') {
    const isNftContracts = !!item.nftContract;
    const nftInfo = isNftContracts ? item.nftContract : item.nftToken;
    const abi = nftInfo?.is_erc721
      ? 'ERC721'
      : nftInfo?.is_erc1155
      ? 'ERC1155'
      : '';
    return {
      chainServerId: item?.chain,
      contractId: nftInfo?.contract_id || '',
      spender: (token as Spender).id,
      tokenId: (nftInfo as NFTApproval)?.inner_id || null,
      abi,
      isApprovedForAll: nftInfo && 'inner_id' in nftInfo ? false : true,
    };
  }

  return undefined;
};

export function getFinalRiskInfo(contract: ContractApprovalItem) {
  const eva = contract.$contractRiskEvaluation;
  const finalMaxScore = Math.max(eva.clientMaxRiskScore, eva.serverRiskScore);

  const isDanger = finalMaxScore >= RiskNumMap.danger;
  const isWarning = !isDanger && finalMaxScore >= RiskNumMap.warning;

  return {
    isServerRisk: eva.serverRiskScore >= RiskNumMap.warning,
    // isServerDanger: eva.serverRiskScore >= RiskNumMap.danger,
    // isServerWarning: eva.serverRiskScore >= RiskNumMap.warning,
    isDanger,
    isWarning,
  };
}

export function openScanLinkFromChainItem(
  scanLink: Chain['scanLink'] | null | undefined,
  address: string,
) {
  if (!scanLink) return;

  openExternalUrl(getAddressScanLink(scanLink, address));
}

export function openNFTLinkFromChainItem(
  chainOrScanLink: Chain | Chain['scanLink'] | null | undefined,
  address: string,
) {
  const scanLink =
    typeof chainOrScanLink === 'string'
      ? chainOrScanLink
      : chainOrScanLink?.scanLink;
  return openScanLinkFromChainItem(scanLink, address);
}

export function maybeNFTLikeItem(
  contractListItem: ContractApprovalItem['list'][number],
): contractListItem is NFTApproval | NFTApprovalContract {
  return (
    'spender' in contractListItem &&
    (contractListItem.is_erc1155 || contractListItem.is_erc721)
  );
}

export type NFTBadgeType = 'nft' | 'collection';
export function getContractNFTType(
  contractApprovalItem: ContractApprovalItem['list'][number],
) {
  const result = {
    nftBadgeType: null as null | NFTBadgeType,
    isNFTToken: false,
    isNFTCollection: false,
  };

  if ('spender' in contractApprovalItem) {
    const maybeNFTSpender =
      contractApprovalItem.spender as SpenderInNFTApproval;

    result.isNFTCollection = !!maybeNFTSpender.$assetParent?.nftContract;
    result.isNFTToken =
      !result.isNFTCollection && !!maybeNFTSpender.$assetParent?.nftToken;

    result.nftBadgeType = result.isNFTCollection ? 'collection' : 'nft';
  }

  return result;
}
