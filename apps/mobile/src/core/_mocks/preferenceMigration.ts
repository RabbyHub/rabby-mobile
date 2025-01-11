import type { ITokenManageSettingMap } from '../services/preference';

export function makeTokenManageSettingMap(): ITokenManageSettingMap {
  return {
    '0x341a1fBD51825E5a107DB54cCb3166DeBA145479': {
      pinedQueue: [
        {
          chainId: 'era',
          tokenId: 'era',
        },
        {
          chainId: 'eth',
          tokenId: 'eth',
        },
        {
          chainId: 'dbk',
          tokenId: 'dbk',
        },
      ],
      unfoldTokens: [
        {
          chainId: 'matic',
          tokenId: 'matic',
        },
      ],
    },
    '0x25C4C3E7ABc0c731f2DF0147FdE7ef75eE34BB5E': {
      foldTokens: [
        {
          chainId: 'eth',
          tokenId: 'eth',
        },
        {
          chainId: 'avax',
          tokenId: 'avax',
        },
      ],
      unfoldTokens: [
        {
          chainId: 'op',
          tokenId: 'op',
        },
      ],
    },
    '0x10B26700B0a2d3F5eF12fA250aba818eE3b43bf4': {
      unfoldTokens: [
        {
          chainId: 'eth',
          tokenId: 'eth',
        },
        {
          chainId: 'avax',
          tokenId: 'avax',
        },
      ],
    },
  };
}
