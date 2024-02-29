export type ProviderRequest<TMethod extends string = string> = {
  data: {
    method: TMethod;
    params?: any;
    $ctx?: {
      postMessageToWebView?: (msg: any, origin: string) => void;
    } & Record<string, any>;
  };
  session: {
    name: string;
    origin: string;
    icon: string;
  };
  origin?: string;
  requestedApproval?: boolean;
};
