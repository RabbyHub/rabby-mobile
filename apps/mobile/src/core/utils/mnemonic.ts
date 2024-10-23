import * as bip39 from '@scure/bip39';
import { HDKey } from 'ethereum-cryptography/hdkey';
import * as sigUtil from 'eth-sig-util';
import { bytesToHex, publicToAddress, privateToPublic } from '@ethereumjs/util';

function _addressFromPublicKey(publicKey: Uint8Array) {
  return bytesToHex(publicToAddress(publicKey, true)).toLowerCase();
}

export const getAddressFromMnemonic = (mnemonic: string, index: number) => {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hdWallet = HDKey.fromMasterSeed(seed);
  const child = hdWallet!.derive(`m/44'/60'/0'/0/${index}`);
  const publicKey = privateToPublic(child.privateKey!);

  const address = sigUtil.normalize(_addressFromPublicKey(publicKey));

  return address;
};
