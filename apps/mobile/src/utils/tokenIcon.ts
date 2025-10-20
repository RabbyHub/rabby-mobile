import React from 'react';
import { SvgProps } from 'react-native-svg';

import AaveSVG from '@/assets2024/images/tokens/aave.svg';
import BalSVG from '@/assets2024/images/tokens/bal.svg';
import CbbtcSVG from '@/assets2024/images/tokens/cbbtc.svg';
import CbethSVG from '@/assets2024/images/tokens/cbeth.svg';
import CrvSVG from '@/assets2024/images/tokens/crv.svg';
import CrvusdSVG from '@/assets2024/images/tokens/crvusd.svg';
import DaiSVG from '@/assets2024/images/tokens/dai.svg';
import DefaultSVG from '@/assets2024/images/tokens/default.svg';
import EbtcSVG from '@/assets2024/images/tokens/ebtc.svg';
import EnsSVG from '@/assets2024/images/tokens/ens.svg';
import EthxSVG from '@/assets2024/images/tokens/ethx.svg';
import EusdeSVG from '@/assets2024/images/tokens/eusde.svg';
import EzethSVG from '@/assets2024/images/tokens/ezeth.svg';
import FbtcSVG from '@/assets2024/images/tokens/fbtc.svg';
import FraxSVG from '@/assets2024/images/tokens/frax.svg';
import FxsSVG from '@/assets2024/images/tokens/fxs.svg';
import GhoSVG from '@/assets2024/images/tokens/gho.svg';
import KncSVG from '@/assets2024/images/tokens/knc.svg';
import LbtcSVG from '@/assets2024/images/tokens/lbtc.svg';
import LdoSVG from '@/assets2024/images/tokens/ldo.svg';
import LinkSVG from '@/assets2024/images/tokens/link.svg';
import LusdSVG from '@/assets2024/images/tokens/lusd.svg';
import MkrSVG from '@/assets2024/images/tokens/mkr.svg';
import OsethSVG from '@/assets2024/images/tokens/oseth.svg';
import PyusdSVG from '@/assets2024/images/tokens/pyusd.svg';
import RethSVG from '@/assets2024/images/tokens/reth.svg';
import RlusdSVG from '@/assets2024/images/tokens/rlusd.svg';
import RplSVG from '@/assets2024/images/tokens/rpl.svg';
import RsethSVG from '@/assets2024/images/tokens/rseth.svg';
import SdaiSVG from '@/assets2024/images/tokens/sdai.svg';
import SnxSVG from '@/assets2024/images/tokens/snx.svg';
import StgSVG from '@/assets2024/images/tokens/stg.svg';
import SusdeSVG from '@/assets2024/images/tokens/susde.svg';
import TbtcSVG from '@/assets2024/images/tokens/tbtc.svg';
import TethSVG from '@/assets2024/images/tokens/teth.svg';
import UniSVG from '@/assets2024/images/tokens/uni.svg';
import UsdcSVG from '@/assets2024/images/tokens/usdc.svg';
import UsdeSVG from '@/assets2024/images/tokens/usde.svg';
import UsdsSVG from '@/assets2024/images/tokens/usds.svg';
import UsdtSVG from '@/assets2024/images/tokens/usdt.svg';
import UsdtbSVG from '@/assets2024/images/tokens/usdtb.svg';
import WbtcSVG from '@/assets2024/images/tokens/wbtc.svg';
import WeethSVG from '@/assets2024/images/tokens/weeth.svg';
import WethSVG from '@/assets2024/images/tokens/weth.svg';
import WstethSVG from '@/assets2024/images/tokens/wsteth.svg';
import XautSVG from '@/assets2024/images/tokens/xaut.svg';

// Token symbol到SVG组件的映射（一期需要的代币，全部小写）
const TOKEN_ICON_MAP: Record<string, React.FC<SvgProps>> = {
  // 基础代币
  weth: WethSVG,
  wbtc: WbtcSVG,
  usdc: UsdcSVG,
  dai: DaiSVG,
  link: LinkSVG,
  aave: AaveSVG,
  usdt: UsdtSVG,
  lusd: LusdSVG,
  crv: CrvSVG,
  mkr: MkrSVG,
  snx: SnxSVG,
  bal: BalSVG,
  uni: UniSVG,
  ldo: LdoSVG,
  ens: EnsSVG,
  frax: FraxSVG,
  gho: GhoSVG,
  rpl: RplSVG,
  stg: StgSVG,
  knc: KncSVG,
  fxs: FxsSVG,
  pyusd: PyusdSVG,
  lbtc: LbtcSVG,
  rlusd: RlusdSVG,
  fbtc: FbtcSVG,
  eurc: DefaultSVG, // 暂时使用默认图标
  xaut: XautSVG,

  // 特殊格式代币
  wsteth: WstethSVG,
  cbeth: CbethSVG,
  reth: RethSVG,
  '1inch': DefaultSVG, // 暂时使用默认图标
  sdai: SdaiSVG,
  crvusd: CrvusdSVG,
  weeth: WeethSVG,
  oseth: OsethSVG,
  usde: UsdeSVG,
  ethx: EthxSVG,
  susde: SusdeSVG,
  tbtc: TbtcSVG,
  cbbtc: CbbtcSVG,
  usds: UsdsSVG,
  rseth: RsethSVG,
  ebtc: EbtcSVG,
  eusde: EusdeSVG,
  teth: TethSVG,
  ezeth: EzethSVG,
  usdtb: UsdtbSVG,

  // PT代币（暂时使用默认图标）
  'pt-eusde-29may2025': DefaultSVG,
  'pt-susde-31jul2025': DefaultSVG,
  'pt-usde-31jul2025': DefaultSVG,
  'pt-eusde-14aug2025': DefaultSVG,
  'pt-susde-25sep2025': DefaultSVG,
  'pt-usde-25sep2025': DefaultSVG,
  'pt-susde-27nov2025': DefaultSVG,
  'pt-usde-27nov2025': DefaultSVG,
};

/**
 * 通过token symbol获取对应的本地SVG图标组件
 * @param symbol token的symbol
 * @returns SVG组件或null
 */
export const getTokenIcon = (symbol: string): React.FC<SvgProps> | null => {
  if (!symbol) {
    return null;
  }

  // 直接小写匹配（因为映射表全部使用小写）
  const lowerMatch = TOKEN_ICON_MAP[symbol.toLowerCase()];
  if (lowerMatch) {
    return lowerMatch;
  }

  // 如果没有找到匹配的图标，返回默认图标
  return DefaultSVG;
};
