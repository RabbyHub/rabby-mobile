import { getChainList, type Chain } from '@/constant/chains';
import type { ProposalTypes } from '@walletconnect/types';
import type { Account } from '@/types/account';
import { findChain } from '@/utils/chain';
import {
  WALLETCONNECT_NAMESPACE,
  WALLETCONNECT_SUPPORTED_METHODS,
} from './constants';
import type { WalletConnectNamespaces } from './types';

export function chainToCaip2(chain: Pick<Chain, 'id'>) {
  return `${WALLETCONNECT_NAMESPACE}:${chain.id}`;
}

export function accountToCaip10(
  account: Pick<Account, 'address'>,
  chain: Chain,
) {
  return `${chainToCaip2(chain)}:${account.address.toLowerCase()}`;
}

export function getWalletConnectSupportedChains() {
  return getChainList('mainnet').map(chainToCaip2);
}

export function getWalletConnectAccounts(account: Account) {
  return getChainList('mainnet').map(chain => accountToCaip10(account, chain));
}

export function getWalletConnectChainByCaip2(caip2?: string | null) {
  if (!caip2?.startsWith(`${WALLETCONNECT_NAMESPACE}:`)) {
    return null;
  }

  const [, rawChainId] = caip2.split(':');
  const chainId = Number(rawChainId);
  if (!Number.isFinite(chainId)) {
    return null;
  }

  return findChain({ id: chainId }) || null;
}

export function getWalletConnectChainByProviderContext(
  chainId?: string | null,
) {
  return getWalletConnectChainByCaip2(chainId);
}

export function getWalletConnectChainIdForRequest(chainId?: string | null) {
  const chain = getWalletConnectChainByCaip2(chainId);
  return chain ? chainToCaip2(chain) : null;
}

export function isSupportedWalletConnectMethod(method: string) {
  return WALLETCONNECT_SUPPORTED_METHODS.includes(method);
}

export function getAddressFromCaip10(account: string) {
  const parts = account.split(':');
  return parts.length === 3 ? parts[2] : '';
}

export function getChainsFromNamespaces(
  namespaces: WalletConnectNamespaces | undefined,
) {
  const chains = new Set<string>();

  Object.entries(namespaces || {}).forEach(([namespaceKey, namespace]) => {
    if (namespaceKey.startsWith(`${WALLETCONNECT_NAMESPACE}:`)) {
      chains.add(namespaceKey);
    }

    if (Array.isArray(namespace?.chains)) {
      namespace.chains.forEach((chain: string) => {
        if (chain?.startsWith(`${WALLETCONNECT_NAMESPACE}:`)) {
          chains.add(chain);
        }
      });
    }
  });

  return Array.from(chains);
}

export function getMethodsFromNamespaces(
  namespaces: WalletConnectNamespaces | undefined,
) {
  const methods = new Set<string>();

  Object.values(namespaces || {}).forEach(namespace => {
    if (Array.isArray(namespace?.methods)) {
      namespace.methods.forEach((method: string) => {
        if (method) {
          methods.add(method);
        }
      });
    }
  });

  return Array.from(methods);
}

export function getRequestedChainsFromProposal(proposal: ProposalTypes.Struct) {
  return Array.from(
    new Set([
      ...getChainsFromNamespaces(proposal?.requiredNamespaces),
      ...getChainsFromNamespaces(proposal?.optionalNamespaces),
    ]),
  );
}

export function getRequestedMethodsFromProposal(
  proposal: ProposalTypes.Struct,
) {
  return Array.from(
    new Set([
      ...getMethodsFromNamespaces(proposal?.requiredNamespaces),
      ...getMethodsFromNamespaces(proposal?.optionalNamespaces),
    ]),
  );
}

export function getRequiredChainsFromProposal(proposal: ProposalTypes.Struct) {
  return getChainsFromNamespaces(proposal.requiredNamespaces);
}

export function getRequiredMethodsFromProposal(proposal: ProposalTypes.Struct) {
  return getMethodsFromNamespaces(proposal.requiredNamespaces);
}

export function getUnsupportedRequiredChainsFromProposal(
  proposal: ProposalTypes.Struct,
) {
  const supported = new Set(getWalletConnectSupportedChains());
  return getRequiredChainsFromProposal(proposal).filter(
    chain => !supported.has(chain),
  );
}

export function getUnsupportedRequiredMethodsFromProposal(
  proposal: ProposalTypes.Struct,
) {
  const supported = new Set(WALLETCONNECT_SUPPORTED_METHODS);
  return getRequiredMethodsFromProposal(proposal).filter(
    method => !supported.has(method),
  );
}
