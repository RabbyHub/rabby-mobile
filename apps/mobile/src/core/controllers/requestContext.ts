import { INTERNAL_REQUEST_ORIGIN } from '@/constant/internalRequest';
import type { Chain } from '@/constant/chains';
import { findChain } from '@/utils/chain';
import type {
  ProviderRequest,
  ProviderRequestContext,
  ProviderRequestSource,
} from './type';

export function normalizeProviderRequestChainId(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const raw = value.trim();
  if (!raw) {
    return undefined;
  }

  const normalized = raw.startsWith('eip155:') ? raw.split(':')[1] : raw;
  const id = normalized?.startsWith('0x')
    ? Number.parseInt(normalized, 16)
    : Number(normalized);

  return Number.isFinite(id) ? id : undefined;
}

function getRequestSource(request: ProviderRequest): ProviderRequestSource {
  if (request.requestContext?.source) {
    return request.requestContext.source;
  }

  if (request.session?.$mobileCtx?.isFromWalletConnect) {
    return 'walletconnect';
  }

  if ((request.session?.origin || request.origin) === INTERNAL_REQUEST_ORIGIN) {
    return 'internal';
  }

  return 'dapp';
}

export function buildProviderRequestContext(
  request: ProviderRequest,
): ProviderRequestContext {
  const $ctx = request.data?.$ctx || {};
  const chainId = normalizeProviderRequestChainId(
    request.requestContext?.chainId ?? $ctx.chainId,
  );
  const origin =
    request.requestContext?.origin ||
    request.session?.origin ||
    request.origin ||
    '';

  return {
    ...request.requestContext,
    origin,
    source: getRequestSource(request),
    chainId,
    accountAddress:
      request.requestContext?.accountAddress || request.account?.address,
  };
}

export function ensureProviderRequestContext(request: ProviderRequest) {
  request.requestContext = buildProviderRequestContext(request);
  return request.requestContext;
}

export function getProviderRequestChain(
  request: ProviderRequest,
): Chain | null {
  const chainId =
    request.requestContext?.chainId ??
    buildProviderRequestContext(request).chainId;
  if (!chainId) {
    return null;
  }

  return findChain({ id: chainId }) || null;
}
