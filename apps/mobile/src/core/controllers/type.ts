import type { Account } from '@/types/account';

export type MobileContext = {
  fromTabId?: string;
  isFromMobileInnerDapp?: boolean;
  isFromWalletConnect?: boolean;
};

export type MobileSession = {
  name: string;
  origin: string;
  icon: string;
  $mobileCtx?: MobileContext;
};

export type ProviderRequestSource = 'dapp' | 'walletconnect' | 'internal';

export type ProviderRequestContext = {
  origin: string;
  source: ProviderRequestSource;
  chainId?: number;
  accountAddress?: string;
};

export type ProviderRequest<TMethod extends string = string> = {
  data: {
    method: TMethod;
    params?: any;
    $ctx?: {
      chainId?: number;
      postMessageToWebView?: (msg: any, origin: string) => void;
      fromTabId?: string;
    } & Record<string, any>;
  };
  session: MobileSession;
  requestContext?: ProviderRequestContext;
  account?: Account | null;
  origin?: string;
  requestedApproval?: boolean;
};
