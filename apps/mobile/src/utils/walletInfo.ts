import BitgetSVG from '@/assets/icons/wallet/bitget.svg';
import MetaMaskSVG from '@/assets/icons/wallet/metamask.svg';
import TokenPocketSVG from '@/assets/icons/wallet/tp.svg';
import RainbowSVG from '@/assets/icons/wallet/rainbow.svg';
import imTokenSVG from '@/assets/icons/wallet/imtoken.svg';
import ZerionSVG from '@/assets/icons/wallet/zerion.svg';
import MathWalletSVG from '@/assets/icons/wallet/math.svg';
import TrustWalletSVG from '@/assets/icons/wallet/trust.svg';
import WalletConnectSVG from '@/assets/icons/wallet/walletconnect.svg';
import { SvgProps } from 'react-native-svg';
import {
  BRAND_ALIAS_TYPE_TEXT,
  WALLET_NAME,
} from '@rabby-wallet/keyring-utils';

export const WALLET_INFO: Record<WALLET_NAME, WalletInfo> = {
  [WALLET_NAME.Bitget]: {
    name: BRAND_ALIAS_TYPE_TEXT.Bitget,
    icon: BitgetSVG,
    brand: WALLET_NAME.Bitget,
    _wcId: '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
  },
  [WALLET_NAME.MetaMask]: {
    name: BRAND_ALIAS_TYPE_TEXT.MetaMask,
    icon: MetaMaskSVG,
    brand: WALLET_NAME.MetaMask,
    _wcId: 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
  },
  [WALLET_NAME.TP]: {
    name: BRAND_ALIAS_TYPE_TEXT.TP,
    icon: TokenPocketSVG,
    brand: WALLET_NAME.TP,
    _wcId: '20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66',
  },
  [WALLET_NAME.Rainbow]: {
    name: BRAND_ALIAS_TYPE_TEXT.Rainbow,
    icon: RainbowSVG,
    brand: WALLET_NAME.Rainbow,
    _wcId: '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
  },
  [WALLET_NAME.imToken]: {
    name: BRAND_ALIAS_TYPE_TEXT.imToken,
    icon: imTokenSVG,
    brand: WALLET_NAME.imToken,
    _wcId: 'ef333840daf915aafdc4a004525502d6d49d77bd9c65e0642dbaefb3c2893bef',
  },
  [WALLET_NAME.Zerion]: {
    name: BRAND_ALIAS_TYPE_TEXT.Zerion,
    icon: ZerionSVG,
    brand: WALLET_NAME.Zerion,
    _wcId: 'ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18',
  },
  [WALLET_NAME.MathWallet]: {
    name: BRAND_ALIAS_TYPE_TEXT.MATHWALLET,
    icon: MathWalletSVG,
    brand: WALLET_NAME.MathWallet,
    _wcId: '7674bb4e353bf52886768a3ddc2a4562ce2f4191c80831291218ebd90f5f5e26',
  },
  [WALLET_NAME.TRUSTWALLET]: {
    name: BRAND_ALIAS_TYPE_TEXT.TRUSTWALLET,
    icon: TrustWalletSVG,
    brand: WALLET_NAME.TRUSTWALLET,
    _wcId: '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
  },
  [WALLET_NAME.UnknownWallet]: {
    name: BRAND_ALIAS_TYPE_TEXT.Bitget,
    icon: WalletConnectSVG,
    brand: WALLET_NAME.UnknownWallet,
  },
};

export type WalletInfo = {
  name: string;
  icon: React.FC<SvgProps>;
  brand: WALLET_NAME;
  _wcId?: string;
};
