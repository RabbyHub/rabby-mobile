import { Abstraction } from '@rabby-wallet/hyperliquid-sdk';

interface PerpsAgentAbstractionExchange {
  agentSetAbstraction: (
    abstraction: Abstraction,
  ) => Promise<{ status?: unknown } | undefined>;
}

/**
 * Shared post-approval policy used by the existing Simple flow and Pro action
 * approval. Keeping this call shared prevents the two views from diverging.
 */
export const setPerpsAgentUnifiedAccount = async (
  exchange: PerpsAgentAbstractionExchange | null | undefined,
) => {
  if (!exchange) {
    throw new Error('Hyperliquid exchange client unavailable');
  }
  const response = await exchange.agentSetAbstraction(
    Abstraction.UNIFIED_ACCOUNT,
  );
  if (response?.status !== 'ok') {
    throw new Error('Hyperliquid rejected Unified Account configuration');
  }
  return response;
};
