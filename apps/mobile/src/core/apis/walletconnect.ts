import { WalletConnectKeyring } from '@rabby-wallet/eth-walletconnect-keyring';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';

export async function getUri(brandName: string) {
  let uri: string | undefined;

  try {
    const keyring = (await getKeyring(
      KEYRING_TYPE.WalletConnectKeyring,
    )) as unknown as WalletConnectKeyring;

    const res = await keyring.initConnector(brandName);
    uri = res.uri;
  } catch (e) {
    console.error(e);
  }

  return uri;
}
