import { useCallback, useState } from 'react';
import { useAccounts } from '@/hooks/account';
import { polymarketService } from '@/core/services/polymarket/polymarketService';
import { ApiKeyCreds } from '@polymarket/clob-client';

// Types for Polymarket integration
interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  volume: string;
  endDate: string;
  outcomes: PolymarketOutcome[];
}

interface PolymarketOutcome {
  id: string;
  name: string;
  price: string;
  shares: string;
}

export const usePolymarket = () => {
  const { accounts } = useAccounts({ disableAutoFetch: true });
  const currentAccount = accounts[0]; // Use the first account as the current account
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creds, setCreds] = useState<ApiKeyCreds | null>(null);

  // Authentication function using Polymarket service
  const authenticate = useCallback(async () => {
    if (!currentAccount) {
      setError('No wallet connected');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await polymarketService.authenticate(currentAccount);
      console.debug('[feat] success', success);
      const creds = await polymarketService.makeCreds();
      console.debug('[feat] creds', creds);
      setCreds(creds ?? null);

      return success;
    } catch (err: any) {
      setError('Failed to authenticate with Polymarket: ' + err.message);
      console.error(err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount]);

  const fetchMarkets = useCallback(async () => {
    if (!polymarketService.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      const markets = await polymarketService.fetchTrendingMarkets();
      return markets;
    } catch (err) {
      setError('Failed to fetch markets');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMarketDetail = useCallback(
    async (marketId: string): Promise<PolymarketMarket> => {
      if (!polymarketService.isAuthenticated()) {
        throw new Error('Not authenticated');
      }

      setIsLoading(true);
      setError(null);

      try {
        const market = await polymarketService.fetchMarketDetails(marketId);
        return market;
      } catch (err) {
        setError('Failed to fetch market details');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const buyOutcome = useCallback(
    async (outcomeId: string, amount: string, price: string) => {
      if (!polymarketService.isAuthenticated() || !currentAccount) {
        throw new Error('Not authenticated');
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await polymarketService.buyOutcome(
          outcomeId,
          amount,
          price,
        );
        return result;
      } catch (err) {
        setError('Failed to buy outcome');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentAccount],
  );

  const sellOutcome = useCallback(
    async (outcomeId: string, amount: string, price: string) => {
      if (!polymarketService.isAuthenticated() || !currentAccount) {
        throw new Error('Not authenticated');
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await polymarketService.sellOutcome(
          outcomeId,
          amount,
          price,
        );
        return result;
      } catch (err) {
        setError('Failed to sell outcome');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentAccount],
  );

  return {
    isAuthenticated: polymarketService.isAuthenticated(),
    isLoading,
    error,
    authenticate,
    fetchMarkets,
    fetchMarketDetail,
    buyOutcome,
    sellOutcome,
  };
};
