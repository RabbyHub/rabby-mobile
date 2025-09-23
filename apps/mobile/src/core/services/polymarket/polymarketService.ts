import { ClobClient } from '@polymarket/clob-client';
import { SignatureType } from '@polymarket/order-utils';
import { keyringService } from '@/core/services';
import { Account } from '@/core/services/preference';
// Use Side enum from clob-client types to avoid type conflicts
import type { Side } from '@polymarket/clob-client/dist/types';
import { ethers, Wallet } from 'ethers';
import { JsonRpcSigner } from '@ethersproject/providers';
import { EthereumProvider } from '@/core/apis/buildinProvider';
import { getGlobalProvider } from '@/core/apis/globalProvider';

// Polymarket API configuration
const POLYMARKET_API_URL = 'https://clob.polymarket.com';
const CHAIN_ID = 137; // Polygon

// Types for market data
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

// Simple signer interface that matches what ClobClient expects
interface SimpleSigner {
  signMessage(message: string): Promise<string>;
  signTypedData(domain: any, types: any, value: any): Promise<string>;
  getAddress(): Promise<string>;
}

// Custom signer that uses our existing ETH signing capabilities
// class RabbySigner implements JsonRpcSigner {
//   private account: Account;

//   constructor(account: Account) {
//     this.account = account;
//   }

//   async getAddress(): Promise<string> {
//     return this.account.address;
//   }

//   async signMessage(message: string): Promise<string> {
//     try {
//       const msgParams = {
//         from: this.account.address,
//         data: message,
//       };

//       // Get the keyring for the account
//       const keyring = await keyringService.getKeyringForAccount(this.account.address);

//       // Sign the message using the keyring service
//       const signature = await keyringService.signPersonalMessage(keyring, msgParams);
//       return signature;
//     } catch (error) {
//       console.error('Failed to sign message:', error);
//       throw new Error('Failed to sign message');
//     }
//   }

//   async signTypedData(domain: any, types: any, value: any): Promise<string> {
//     try {
//       // Convert the typed data to a format our keyring service can handle
//       const typedData = {
//         domain,
//         types,
//         value,
//         primaryType: Object.keys(types).find(key => key !== 'EIP712Domain') || '',
//       };

//       const msgParams = {
//         from: this.account.address,
//         data: JSON.stringify(typedData),
//       };

//       // Get the keyring for the account
//       const keyring = await keyringService.getKeyringForAccount(this.account.address);

//       // Sign the typed data using the keyring service
//       const signature = await keyringService.signTypedMessage(keyring, msgParams, { version: 'V4' });
//       return signature;
//     } catch (error) {
//       console.error('Failed to sign typed data:', error);
//       throw new Error('Failed to sign typed data');
//     }
//   }

//   async _signTypedData(domain: any, types: any, value: any): Promise<string> {
//     return this.signTypedData(domain, types, value);
//   }
// }

export class PolymarketService {
  private clobClient: ClobClient | null = null;
  // private signer: RabbySigner | null = null;

  constructor() {
    // Initialize without authentication
  }

  #getProviderFromAccount(account: Account) {
    const currentProvider = new EthereumProvider();

    // const buildinProvider = getGlobalProvider();
    // if (!buildinProvider) {
    //   throw new Error('No global provider found');
    // }

    // const currentProvider = buildinProvider.currentProvider;

    currentProvider.currentAccount = account.address;
    currentProvider.currentAccountType = account.type;
    currentProvider.currentAccountBrand = account.brandName;
    // currentProvider.chainId = networkId;
    const provider = new ethers.providers.Web3Provider(currentProvider);
    const signer = provider.getSigner(account.address) as JsonRpcSigner;

    return {
      provider,
      signer,
    };
  }

  /**
   * Authenticate with Polymarket using ETH signature
   */
  async authenticate(account: Account): Promise<boolean> {
    console.debug('[feat] account', account);
    try {
      const signer = this.#getProviderFromAccount(account).signer;

      // Initialize the CLOB client with our custom signer
      // Note: ClobClient expects Wallet | JsonRpcSigner, but our custom signer should work
      // since it implements the required methods
      this.clobClient = new ClobClient(
        POLYMARKET_API_URL,
        CHAIN_ID,
        signer, // Use the signer we created
        undefined, // No need for API credentials when we have a proper signer
        SignatureType.EOA,
      );
      console.debug('[feat] clobClient', this.clobClient);

      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw new Error('Failed to authenticate with Polymarket');
    }
  }

  async makeCreds() {
    if (!this.clobClient) {
      throw new Error('ClobClient not initialized');
    }

    // const address = await this.signer.getAddress();
    // const timestamp = Math.floor(Date.now() / 1000).toString();
    // const nonce = Math.floor(Math.random() * 1000000).toString();
    // const message = `POLY_API\nAddress: ${address}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;

    // const signature = await this.signer.signMessage(message);

    // return {
    //   POLY_ADDRESS: address,
    //   POLY_SIGNATURE: signature,
    //   POLY_TIMESTAMP: timestamp,
    //   POLY_NONCE: nonce,
    // };
    const creds = await this.clobClient?.createOrDeriveApiKey();

    console.debug('[feat] creds', creds);

    return creds;
  }

  /**
   * Fetch trending markets from Polymarket
   */
  async fetchTrendingMarkets(): Promise<PolymarketMarket[]> {
    if (!this.clobClient) {
      throw new Error('Not authenticated with Polymarket');
    }

    try {
      // Fetch markets from the Polymarket API
      const response = await this.clobClient.getMarkets();

      // Transform the response data to match our PolymarketMarket interface
      return response.data.map((market: any) => ({
        id: market.id,
        question: market.question,
        description: market.description,
        volume: market.volume,
        endDate: market.endDate,
        outcomes:
          market.outcomes?.map((outcome: any) => ({
            id: outcome.id,
            name: outcome.name,
            price: outcome.price,
            shares: outcome.shares,
          })) || [],
      }));
    } catch (error) {
      console.error('Failed to fetch markets:', error);
      throw new Error('Failed to fetch markets from Polymarket');
    }
  }

  /**
   * Fetch market details
   */
  async fetchMarketDetails(marketId: string): Promise<PolymarketMarket> {
    if (!this.clobClient) {
      throw new Error('Not authenticated with Polymarket');
    }

    try {
      // Fetch market details from the Polymarket API
      const response = await this.clobClient.getMarket(marketId);

      // Transform the response data to match our PolymarketMarket interface
      return {
        id: response.id,
        question: response.question,
        description: response.description,
        volume: response.volume,
        endDate: response.endDate,
        outcomes:
          response.outcomes?.map((outcome: any) => ({
            id: outcome.id,
            name: outcome.name,
            price: outcome.price,
            shares: outcome.shares,
          })) || [],
      };
    } catch (error) {
      console.error('Failed to fetch market details:', error);
      throw new Error('Failed to fetch market details from Polymarket');
    }
  }

  /**
   * Create and sign an order to buy outcome tokens
   */
  async buyOutcome(
    outcomeId: string,
    amount: string,
    price: string,
  ): Promise<any> {
    if (!this.clobClient) {
      throw new Error('Not authenticated with Polymarket');
    }

    try {
      // Create the order using ClobClient's createOrder method
      // Note: In a real implementation, outcomeId would be the tokenId and we'd need proper market data
      const userOrder = {
        tokenID: outcomeId, // In real implementation, this would be the actual token ID
        price: parseFloat(price),
        size: parseFloat(amount),
        side: 'BUY' as Side, // Use string literal to match clob-client Side type
        feeRateBps: 0, // No fees for demo
      };

      // Create and sign the order using the CLOB client
      const signedOrder = await this.clobClient.createOrder(userOrder, {
        tickSize: '0.001', // Default tick size
      });

      // Submit the order to the CLOB client
      const result = await this.clobClient.postOrder(signedOrder);

      return { success: true, orderId: result.id, order: result };
    } catch (error) {
      console.error('Failed to create buy order:', error);
      throw new Error(
        'Failed to create buy order: ' + (error as Error).message,
      );
    }
  }

  /**
   * Create and sign an order to sell outcome tokens
   */
  async sellOutcome(
    outcomeId: string,
    amount: string,
    price: string,
  ): Promise<any> {
    if (!this.clobClient) {
      throw new Error('Not authenticated with Polymarket');
    }

    try {
      // Create the order using ClobClient's createOrder method
      // Note: In a real implementation, outcomeId would be the tokenId and we'd need proper market data
      const userOrder = {
        tokenID: outcomeId, // In real implementation, this would be the actual token ID
        price: parseFloat(price),
        size: parseFloat(amount),
        side: 'SELL' as Side, // Use string literal to match clob-client Side type
        feeRateBps: 0, // No fees for demo
      };

      // Create and sign the order using the CLOB client
      const signedOrder = await this.clobClient.createOrder(userOrder, {
        tickSize: '0.001', // Default tick size
      });

      // Submit the order to the CLOB client
      const result = await this.clobClient.postOrder(signedOrder);

      return { success: true, orderId: result.id, order: result };
    } catch (error) {
      console.error('Failed to create sell order:', error);
      throw new Error(
        'Failed to create sell order: ' + (error as Error).message,
      );
    }
  }

  /**
   * Check if the service is authenticated
   */
  isAuthenticated(): boolean {
    return this.clobClient !== null /*  && this.signer !== null */;
  }
}

// Export singleton instance
export const polymarketService = new PolymarketService();
