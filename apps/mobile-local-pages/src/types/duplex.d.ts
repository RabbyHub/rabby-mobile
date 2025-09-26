type RuntimeInfo = {
  runtimeBaseUrl: string;
  platform: 'ios' | 'android';
  isDev: boolean;
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
