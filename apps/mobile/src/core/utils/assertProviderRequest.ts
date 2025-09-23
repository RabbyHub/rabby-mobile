import { isAddress } from 'viem';
import { ProviderRequest } from '../controllers/type';

export function assertProviderRequest(
  args: ProviderRequest,
  scene: string,
): asserts args is Omit<ProviderRequest, 'session' | 'account'> & {
  session: NonNullable<ProviderRequest['session']>;
  account: NonNullable<ProviderRequest['account']>;
} & Record<string, any> {
  const { session, account } = args;
  if (!session) {
    throw new Error(`[${scene}] Invalid session`);
  }
  if (!account) {
    throw new Error(`[${scene}] Account is undefined or null`);
  }
  if (!isAddress(account.address)) {
    throw new Error(`[${scene}] Invalid address: ${account.address}`);
  }
}
