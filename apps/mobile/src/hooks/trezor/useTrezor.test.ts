import { Linking } from 'react-native';
import TrezorConnect from '@trezor/connect-mobile';
import { startSubscribeTrezorConnectOnUrl } from './useTrezor';

jest.mock('@trezor/connect-mobile', () => ({
  __esModule: true,
  default: { handleDeeplink: jest.fn() },
}));

describe('startSubscribeTrezorConnectOnUrl', () => {
  it('forwards only Trezor return links to handleDeeplink', () => {
    const add = jest
      .spyOn(Linking, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as any);
    startSubscribeTrezorConnectOnUrl();
    const onUrl = add.mock.calls[0][1] as (e: { url: string }) => void;

    onUrl({ url: 'https://go.rabby.io/wc?uri=abc' });
    onUrl({ url: 'not a url' });
    expect(TrezorConnect.handleDeeplink).not.toHaveBeenCalled();

    const trezorUrl = 'https://go.rabby.io/connect-trezor?id=1&response={}';
    onUrl({ url: trezorUrl });
    expect(TrezorConnect.handleDeeplink).toHaveBeenCalledWith(trezorUrl);
  });
});
