import { ClobClient } from '@polymarket/clob-client';
import { SignatureType } from '@polymarket/order-utils';
import { Account } from '@/core/services/preference';
// Use Side enum from clob-client types to avoid type conflicts
import type { ApiKeyCreds, Side } from '@polymarket/clob-client/dist/types';
import { Contract, ethers, Wallet } from 'ethers';
import { JsonRpcSigner } from '@ethersproject/providers';
import { EthereumProvider } from '@/core/apis/buildinProvider';
import { safeProxyABI } from './abis';
import { abiCoder } from '@/core/apis/sendRequest';
import { requestETHRpc, sendRequest } from '@/core/apis/provider';
import { RelayClient } from '@polymarket/relayer-client';
import { createWalletClient, decodeAbiParameters, http } from 'viem';
import { polygon } from 'viem/chains'; // Import the Polygon chain
import { INTERNAL_REQUEST_SESSION } from '@/constant';

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

const FACTORY_ADDRESS = '0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b';
const SAFE_MASTER_COPY = '0x6851D6fDFAfD08c0295C392436245E5bc78B0185'; // Safe v1.1.1
const chainId = 137;
const RPC_URL = process.env.RPC_URL || 'https://relayer-v2.polymarket.com';

export class PolymarketService {
  private clobClient: ClobClient | null = null;
  // private signer: RabbySigner | null = null;

  private creds: ApiKeyCreds | null = null;

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
    const provider = new ethers.providers.Web3Provider(currentProvider);
    const signer = provider.getSigner(account.address) as JsonRpcSigner;

    return {
      provider,
      signer,
    };
  }

  // SOL Data
  async #getProxyAddress(address: string) {
    const computeProxyAddress = safeProxyABI.find(
      f => f.name === 'computeProxyAddress',
    );
    if (!computeProxyAddress) {
      throw new Error('computeProxyAddress ABI not found');
    }
    const data = abiCoder.encodeFunctionCall(computeProxyAddress as any, [
      address,
    ]);

    const result = await requestETHRpc(
      {
        method: 'eth_call',
        params: [
          {
            // from: address,
            to: FACTORY_ADDRESS,
            data,
          },
          'latest',
        ],
      },
      'matic',
    );
    const addr = decodeAbiParameters(
      computeProxyAddress.outputs!,
      result as `0x${string}`,
    )[0];
    console.debug('[feat] #getProxyAddress:: result', result, addr);

    return addr as `0x${string}`;
  }

  async #getCode(address: string) {
    const result = await requestETHRpc(
      {
        method: 'eth_getCode',
        params: [address, 'latest'],
      },
      'matic',
    );
    return result;
  }

  async createProxyAddress(account: Account) {
    const { signer, provider } = this.#getProviderFromAccount(account);

    // const userEOA = await signer.getAddress();

    const factory = new ethers.Contract(FACTORY_ADDRESS, safeProxyABI, signer);

    const proxyAddress = await this.#getProxyAddress(account.address);
    console.debug('[feat] proxyAddress', proxyAddress);

    const code = await this.#getCode(proxyAddress);
    if (code !== '0x') {
      console.debug('[feat] Already deployed');
      return proxyAddress;
    }

    console.debug('[feat] Not deployed', code);

    const sig = await this.#signCreateProxy(account, signer);
    console.debug('[feat] sig', sig);

    const sigs = ethers.utils.splitSignature(sig);
    console.debug('[feat] sigs', sigs);

    const createProxy = safeProxyABI.find(f => f.name === 'createProxy');
    if (!createProxy) {
      throw new Error('createProxy ABI not found');
    }

    const data = abiCoder.encodeFunctionCall(createProxy as any, [
      ethers.constants.AddressZero, // paymentToken = MATIC
      0, // payment = 0
      ethers.constants.AddressZero, // paymentReceiver = none
      [
        // need uint8 of sigs.v,
        sigs.v,
        // ethers.utils.hexZeroPad(sigs.r, 32),
        sigs.r,
        // ethers.utils.hexZeroPad(sigs.s, 32),
        sigs.s,
      ] as any,
    ]);

    const result = await sendRequest({
      data: {
        method: 'eth_sendTransaction',
        // params: [{ to: FACTORY_ADDRESS, data }, 'latest'],
        params: [
          {
            from: account.address,
            to: FACTORY_ADDRESS,
            chainId: chainId,
            value: '0x',
            data,
          },
        ],
      },
      session: INTERNAL_REQUEST_SESSION,
      // 'matic',
      account,
    });
    console.debug('[feat] result', result);

    // const wallet = createWalletClient({
    //   account: account.address as `0x${string}`,
    //   chain: polygon,
    //   transport: http(RPC_URL)
    // });
    // console.debug("[feat] signer ", signer instanceof JsonRpcSigner);

    // const relayClient = new RelayClient(RPC_URL, chainId, signer);
    // console.debug("[feat] relayClient", relayClient);

    // const deployResult = await relayClient.deploySafe();
    // console.debug("[feat] deployResult", deployResult);

    return proxyAddress;
  }

  async #signCreateProxy(account: Account, signer: JsonRpcSigner) {
    const types = {
      CreateProxy: safeProxyABI
        .find(f => f.name === 'createProxy')!
        .inputs.slice(0, 3),
    };

    // 3. EIP-712 Domain
    const domain = {
      name: 'Polymarket Contract Proxy Factory',
      // version: "1",
      chainId: `${chainId}`,
      verifyingContract: FACTORY_ADDRESS,
    };

    const message = {
      paymentToken: ethers.constants.AddressZero, // MATIC
      payment: 0,
      paymentReceiver: ethers.constants.AddressZero,
    };
    const signature = await signer._signTypedData(domain, types, message);

    // const signature = await sendRequest({
    //   data: {
    //     method: 'eth_signTypedDataV4',
    //     params: [account.address, JSON.stringify({ types, domain, message })],
    //   },
    //   session: INTERNAL_REQUEST_SESSION,
    //   account: account,
    // });
    console.debug('[feat] Signature:', signature);

    return signature;
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
    const creds = await this.clobClient?.createOrDeriveApiKey();
    console.debug('[feat] creds', creds);

    this.creds = creds;
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
