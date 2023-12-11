import { WalletConnectKeyring } from '@rabby-wallet/eth-walletconnect-keyring';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';

export async function getUri(brandName: string) {
  const keyring = (await getKeyring(
    KEYRING_TYPE.WalletConnectKeyring,
  )) as unknown as WalletConnectKeyring;

  const { uri } = await keyring.initConnector(brandName);

  return uri;
}
