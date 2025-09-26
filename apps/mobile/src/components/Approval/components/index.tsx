import { Connect } from './Connect';
import { SignText } from './SignText';
import { SignTypedData } from './SignTypedData';
import { SignTx } from './SignTx/SignTx';
import { LedgerHardwareWaiting } from './LedgerHardwareWaiting/LedgerHardwareWaiting';
import { OneKeyHardwareWaiting } from './OneKeyHardwareWaiting/OneKeyHardwareWaiting';
import { KeystoneHardwareWaiting } from './KeystoneHardwareWaiting/KeystoneHardwareWaiting';
import { TrezorHardwareWaiting } from './TrezorHardwareWaiting/TrezorHardwareWaiting';

import { PrivatekeyWaiting } from './PrivatekeyWaiting/PrivatekeyWaiting';
import { ETHSign } from './ETHSign/ETHSign';
import { Unknown } from './Unknown/Unknown';
import { AddChain } from './AddChain/AddChain';
import { AddAsset } from './AddAsset/AddAsset';

export const ApprovalComponent = {
  Connect,
  SignText,
  SignTypedData,
  SignTx,
  LedgerHardwareWaiting,
  OneKeyHardwareWaiting,
  TrezorHardwareWaiting,
  KeystoneHardwareWaiting,
  PrivatekeyWaiting,
  ETHSign,
  Unknown,
  AddChain,
  AddAsset,
};

export type ApprovalComponentType = keyof typeof ApprovalComponent;
