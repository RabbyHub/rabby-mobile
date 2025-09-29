import BitgetSVG from '@/assets/icons/wallet/bitget.svg';
import MetaMaskSVG from '@/assets/icons/wallet/metamask.svg';
import TokenPocketSVG from '@/assets/icons/wallet/tp.svg';
import RainbowSVG from '@/assets/icons/wallet/rainbow.svg';
import imTokenSVG from '@/assets/icons/wallet/imtoken.svg';
import ZerionSVG from '@/assets/icons/wallet/zerion.svg';
import MathWalletSVG from '@/assets/icons/wallet/math.svg';
import TrustWalletSVG from '@/assets/icons/wallet/trust.svg';
import WalletConnectSVG from '@/assets/icons/wallet/walletconnect.svg';
import SafeSVG from '@/assets/icons/wallet/safe.svg';
import { SvgProps } from 'react-native-svg';
import {
  BRAND_ALIAS_TYPE_TEXT,
  HARDWARE_KEYRING_TYPES,
  KEYRING_CLASS,
  WALLET_NAME,
} from '@rabby-wallet/keyring-utils';
import {
  PrivateKeySVG,
  SeedPhraseSVG,
  RcIconWatchAddress,
  PrivateKeySVGLight,
  SeedPhraseSVGLight,
} from '@/assets/icons/address';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import KeystoneSVG from '@/assets/icons/wallet/keystone.svg';
import OneKeySVG from '@/assets/icons/wallet/onekey.svg';
import TrezorSVG from '@/assets/icons/wallet/trezor.svg';

export const WALLET_INFO: Record<WALLET_NAME, WalletInfo> = {
  [WALLET_NAME.Bitget]: {
    name: BRAND_ALIAS_TYPE_TEXT.Bitget,
    icon: BitgetSVG,
    brand: WALLET_NAME.Bitget,
    id: '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662',
    deepLink: 'bitkeep:',
    androidPackageName: 'com.bitkeep.wallet',
    displayName: BRAND_ALIAS_TYPE_TEXT.Bitget,
  },
  [WALLET_NAME.MetaMask]: {
    name: BRAND_ALIAS_TYPE_TEXT.MetaMask,
    icon: MetaMaskSVG,
    brand: WALLET_NAME.MetaMask,
    id: 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
    deepLink: 'metamask:',
    androidPackageName: 'io.metamask',
    displayName: BRAND_ALIAS_TYPE_TEXT.MetaMask,
  },
  [WALLET_NAME.TP]: {
    name: BRAND_ALIAS_TYPE_TEXT.TP,
    icon: TokenPocketSVG,
    brand: WALLET_NAME.TP,
    id: '20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66',
    deepLink: 'tpoutside:',
    androidPackageName: 'vip.mytokenpocket',
    displayName: BRAND_ALIAS_TYPE_TEXT.TP,
  },
  [WALLET_NAME.Rainbow]: {
    name: BRAND_ALIAS_TYPE_TEXT.Rainbow,
    icon: RainbowSVG,
    brand: WALLET_NAME.Rainbow,
    id: '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
    deepLink: 'rainbow:',
    androidPackageName: 'me.rainbow',
    displayName: BRAND_ALIAS_TYPE_TEXT.Rainbow,
  },
  [WALLET_NAME.imToken]: {
    name: BRAND_ALIAS_TYPE_TEXT.imToken,
    icon: imTokenSVG,
    brand: WALLET_NAME.imToken,
    id: 'ef333840daf915aafdc4a004525502d6d49d77bd9c65e0642dbaefb3c2893bef',
    deepLink: 'imtokenv2:',
    androidPackageName: 'im.token.app',
    displayName: BRAND_ALIAS_TYPE_TEXT.imToken,
  },
  [WALLET_NAME.Zerion]: {
    name: BRAND_ALIAS_TYPE_TEXT.Zerion,
    icon: ZerionSVG,
    brand: WALLET_NAME.Zerion,
    id: 'ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18',
    deepLink: 'zerion:',
    androidPackageName: 'io.zerion.android',
    displayName: BRAND_ALIAS_TYPE_TEXT.Zerion,
  },
  [WALLET_NAME.MathWallet]: {
    name: BRAND_ALIAS_TYPE_TEXT.MATHWALLET,
    icon: MathWalletSVG,
    brand: WALLET_NAME.MathWallet,
    id: '7674bb4e353bf52886768a3ddc2a4562ce2f4191c80831291218ebd90f5f5e26',
    deepLink: 'mathwallet:',
    androidPackageName: 'com.mathwallet.android',
    displayName: BRAND_ALIAS_TYPE_TEXT.MATHWALLET,
  },
  [WALLET_NAME.TRUSTWALLET]: {
    name: BRAND_ALIAS_TYPE_TEXT.TRUSTWALLET,
    icon: TrustWalletSVG,
    brand: WALLET_NAME.TRUSTWALLET,
    id: '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
    deepLink: 'trust:',
    androidPackageName: 'com.wallet.crypto.trustapp',
    displayName: BRAND_ALIAS_TYPE_TEXT.TRUSTWALLET,
  },
  [WALLET_NAME.UnknownWallet]: {
    name: BRAND_ALIAS_TYPE_TEXT.UnknownWallet,
    icon: WalletConnectSVG,
    brand: WALLET_NAME.UnknownWallet,
    deepLink: '',
    androidPackageName: '',
    universal: '',
    id: '',
    displayName: BRAND_ALIAS_TYPE_TEXT.UnknownWallet,
  },
};

export type WalletInfo = {
  name: string;
  icon: React.FC<SvgProps>;
  brand: WALLET_NAME;
  id: string;
  deepLink: string;
  androidPackageName: string;
  universal?: string;
  useDeepLink?: boolean;
  displayName: string;
};

export const getWalletIcon = (
  brandName: string | undefined,
  isLight?: boolean,
) => {
  if (brandName === KEYRING_CLASS.WATCH) {
    return RcIconWatchAddress;
  }
  if (brandName === KEYRING_CLASS.HARDWARE.LEDGER) {
    return LedgerSVG;
  }

  if (brandName === KEYRING_CLASS.HARDWARE.ONEKEY) {
    return OneKeySVG;
  }

  if (brandName === KEYRING_CLASS.HARDWARE.TREZOR) {
    return TrezorSVG;
  }

  if (brandName === HARDWARE_KEYRING_TYPES.Keystone.brandName) {
    return KeystoneSVG;
  }

  if (brandName === KEYRING_CLASS.GNOSIS) {
    return SafeSVG;
  }

  if (brandName === KEYRING_CLASS.PRIVATE_KEY) {
    return isLight ? PrivateKeySVGLight : PrivateKeySVG;
  }

  if (brandName === KEYRING_CLASS.MNEMONIC) {
    return isLight ? SeedPhraseSVGLight : SeedPhraseSVG;
  }

  return (
    WALLET_INFO?.[brandName as keyof typeof WALLET_INFO]?.icon ||
    WALLET_INFO.UnknownWallet.icon
  );
};
