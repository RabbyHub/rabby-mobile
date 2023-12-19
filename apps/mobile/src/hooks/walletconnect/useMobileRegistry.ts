import { useState, useEffect } from 'react';
import { isPlainObject } from 'lodash';
import { WalletService } from './util';

let cachedWalletServices = [] as Array<WalletService>;

export const useMobileRegistry = () => {
  const [state, setState] = useState({
    data: cachedWalletServices as Array<WalletService>,
    error: undefined,
    loading: true,
  });

  useEffect(() => {
    const loadWallets = async () => {
      try {
        const result = await fetch(
          'https://registry.walletconnect.org/data/wallets.json',
        );
        const data = await result.json();

        if (!data || !isPlainObject(data)) {
          throw new Error('fetch wc error');
        }

        const wallets = Object.values(data) as Array<WalletService>;

        if (!wallets?.length || !wallets[0].id || !wallets[0].mobile) {
          throw new Error('fetch wc error');
        }

        cachedWalletServices = wallets;

        setState({
          data: wallets,
          error: undefined,
          loading: false,
        });
      } catch (error: any) {
        console.error('fetch wc error', error);

        cachedWalletServices = [];
        setState({
          data: [],
          error: error,
          loading: false,
        });
      }
    };

    if (!cachedWalletServices.length) {
      loadWallets();
    }
  }, []);

  return state;
};
