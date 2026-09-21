import type {
  AddrDescResponse,
  Cex,
  ProjectItem,
} from '@rabby-wallet/rabby-api/dist/types';

export const findSupportedExchange = (
  exchanges: readonly ProjectItem[],
  cexId?: string | null,
): ProjectItem | undefined => {
  if (!cexId) {
    return undefined;
  }

  return exchanges.find(
    exchange => exchange.id.toLowerCase() === cexId.toLowerCase(),
  );
};

export const resolveSupportedDepositExchange = (
  detectedCex: Pick<Cex, 'id' | 'is_deposit'> | null | undefined,
  exchanges: readonly ProjectItem[],
): ProjectItem | undefined => {
  if (!detectedCex?.is_deposit) {
    return undefined;
  }

  return findSupportedExchange(exchanges, detectedCex.id);
};

export const projectItemToCex = (exchange: ProjectItem): Cex => ({
  id: exchange.id,
  name: exchange.name,
  logo_url: exchange.logo_url,
  is_deposit: true,
});

export const normalizeCex = (
  detectedCex: Cex | null | undefined,
  exchanges: readonly ProjectItem[],
): Cex | undefined => {
  const supportedExchange = resolveSupportedDepositExchange(
    detectedCex,
    exchanges,
  );

  return supportedExchange ? projectItemToCex(supportedExchange) : undefined;
};

export const normalizeAddressDescCex = (
  desc: AddrDescResponse['desc'] | undefined,
  exchanges: readonly ProjectItem[],
): AddrDescResponse['desc'] | undefined => {
  if (!desc) {
    return undefined;
  }

  return {
    ...desc,
    cex: normalizeCex(desc.cex, exchanges),
  };
};
