import { Account } from '../services/preference';

export type MobileContext = {
  fromTabId?: string;
};

export type MobileSession = {
  name: string;
  origin: string;
  icon: string;
  $mobileCtx?: MobileContext;
};

export type ProviderRequest<TMethod extends string = string> = {
  data: {
    method: TMethod;
    params?: any;
    $ctx?: {
      postMessageToWebView?: (msg: any, origin: string) => void;
      fromTabId?: string;
    } & Record<string, any>;
  };
  session: MobileSession;
  account?: Account;
  origin?: string;
  requestedApproval?: boolean;
};
