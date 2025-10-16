type RuntimeInfo = {
  runtimeBaseUrl: string;
  platform: 'ios' | 'android';
  useDevResource: boolean;
  // TODO: add type
  language?: string;
  isDark: boolean;
  i18nTexts?: Record<string, string>;
  // colors2024: import('@rabby-wallet/base-utils').AppColors2024Variants;
}

type DuplexDefs = {
  RuntimeInfo: {
    post: {
      type: 'GET_RUNTIME_INFO';
    };
    receive: {
      type: 'GOT_RUNTIME_INFO';
      info: RuntimeInfo;
    };
  }
}

type DuplexPost = DuplexDefs[keyof DuplexDefs]['post'];
type DuplexReceive = DuplexDefs[keyof DuplexDefs]['receive'];
