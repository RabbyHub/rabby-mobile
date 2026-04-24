// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace IGAEventSource {
  export type ISendToken = 'dashboard' | 'contact' | 'tokendetail';
  export type ISendNFT = 'nftdetail';
  export type IReceive = 'dashboard' | 'tokendetail';
}

export function filterRbiSource(
  _case: 'sendToken' | 'sendNFT' | 'Receive',
  rbisource: string,
) {
  switch (_case) {
    case 'sendToken':
      switch (rbisource) {
        default:
          return null;
        case 'dashboard':
        case 'contact':
        case 'tokendetail':
          return rbisource as IGAEventSource.ISendToken;
      }
    case 'sendNFT':
      switch (rbisource) {
        default:
          return null;
        case 'nftdetail':
          return rbisource as IGAEventSource.ISendNFT;
      }
    case 'Receive':
      switch (rbisource) {
        default:
          return null;
        case 'dashboard':
        case 'tokendetail':
          return rbisource as IGAEventSource.IReceive;
      }
  }

  return null;
}
