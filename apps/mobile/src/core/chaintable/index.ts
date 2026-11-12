import axios from 'axios';
import type {
  MemeTokenListParams,
  MemeTokenListResult,
  MemeUserPnlResult,
  MemeUserTokenListResult,
} from './types';

const CHAINTABLE_HOST = 'https://api.chaintable.com';
// the server cuts a call off at 4.5s and reports it in the response
const REQUEST_TIMEOUT_MS = 10_000;
const DEADLINE_EXCEEDED = 'call deadline exceeded';

type InvokeResponse<T> = {
  code: number;
  message: string;
  data: {
    success: boolean;
    result: T;
    error: string | null;
  };
};

/**
 * Anonymous function calls: no login or API key. All functions share one rate
 * limit of 120 calls/min per IP. Add new functions here as typed methods.
 */
class ChaintableService {
  private readonly client = axios.create({
    baseURL: CHAINTABLE_HOST,
    timeout: REQUEST_TIMEOUT_MS,
  });

  private readonly call = async <T>(id: string, args: unknown[]) => {
    const { data: body } = await this.client.post<InvokeResponse<T>>(
      '/v1/function/invoke',
      { id, arguments: args },
    );
    if (body.code !== 0) {
      throw new Error(body.message);
    }
    if (!body.data.success) {
      throw new Error(body.data.error || id);
    }
    return body.data.result;
  };

  /** `args` are positional; pass null to skip an optional one. */
  invoke = async <T>(id: string, args: unknown[] = []): Promise<T> => {
    try {
      return await this.call<T>(id, args);
    } catch (error) {
      if ((error as Error).message !== DEADLINE_EXCEEDED) {
        throw error;
      }
      // the backend's advice: one retry usually gets through
      return this.call<T>(id, args);
    }
  };

  getMemeTokenList = ({ symbol, page, pageSize }: MemeTokenListParams) =>
    this.invoke<MemeTokenListResult>('meme_coin.token_list', [
      symbol ?? null,
      page ?? null,
      pageSize ?? null,
    ]);

  getMemeUserTokenList = (address: string) =>
    this.invoke<MemeUserTokenListResult>('meme_coin.user.token_list', [
      address,
    ]);

  getMemeUserPnl = (address: string) =>
    this.invoke<MemeUserPnlResult>('meme_coin.user.pnl', [address]);
}

export const chaintable = new ChaintableService();
