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
import {
  APPROVAL_CONNECT_SERVICE_DEPENDENCIES,
  APPROVAL_DAPP_SERVICE_DEPENDENCIES,
  APPROVAL_SIGN_TX_SERVICE_DEPENDENCIES,
  APPROVAL_SIGN_TYPED_DATA_SERVICE_DEPENDENCIES,
  APPROVAL_WAITING_SERVICE_DEPENDENCIES,
  withApprovalServices,
} from '../approvalServiceDependencies';
import { prepareGasAccountStoreFromService } from '@/screens/GasAccount/hooks/atom';

const ConnectWithServices = withApprovalServices(
  APPROVAL_CONNECT_SERVICE_DEPENDENCIES,
  Connect,
);
const SignTextWithServices = withApprovalServices(
  APPROVAL_DAPP_SERVICE_DEPENDENCIES,
  SignText,
);
const SignTypedDataWithServices = withApprovalServices(
  APPROVAL_SIGN_TYPED_DATA_SERVICE_DEPENDENCIES,
  SignTypedData,
);
const SignTxWithServices = withApprovalServices(
  APPROVAL_SIGN_TX_SERVICE_DEPENDENCIES,
  SignTx,
  {
    prepare: ({ gasAccountService }) => {
      prepareGasAccountStoreFromService(gasAccountService);
    },
  },
);
const LedgerHardwareWaitingWithServices = withApprovalServices(
  APPROVAL_WAITING_SERVICE_DEPENDENCIES,
  LedgerHardwareWaiting,
);
const OneKeyHardwareWaitingWithServices = withApprovalServices(
  APPROVAL_WAITING_SERVICE_DEPENDENCIES,
  OneKeyHardwareWaiting,
);
const KeystoneHardwareWaitingWithServices = withApprovalServices(
  APPROVAL_WAITING_SERVICE_DEPENDENCIES,
  KeystoneHardwareWaiting,
);
const TrezorHardwareWaitingWithServices = withApprovalServices(
  APPROVAL_WAITING_SERVICE_DEPENDENCIES,
  TrezorHardwareWaiting,
);
const PrivatekeyWaitingWithServices = withApprovalServices(
  APPROVAL_WAITING_SERVICE_DEPENDENCIES,
  PrivatekeyWaiting,
);
const AddChainWithServices = withApprovalServices(
  APPROVAL_DAPP_SERVICE_DEPENDENCIES,
  AddChain,
);
const AddAssetWithServices = withApprovalServices(
  APPROVAL_DAPP_SERVICE_DEPENDENCIES,
  AddAsset,
);

export const ApprovalComponent = {
  Connect: ConnectWithServices,
  SignText: SignTextWithServices,
  SignTypedData: SignTypedDataWithServices,
  SignTx: SignTxWithServices,
  LedgerHardwareWaiting: LedgerHardwareWaitingWithServices,
  OneKeyHardwareWaiting: OneKeyHardwareWaitingWithServices,
  TrezorHardwareWaiting: TrezorHardwareWaitingWithServices,
  KeystoneHardwareWaiting: KeystoneHardwareWaitingWithServices,
  PrivatekeyWaiting: PrivatekeyWaitingWithServices,
  ETHSign,
  Unknown,
  AddChain: AddChainWithServices,
  AddAsset: AddAssetWithServices,
};

export type ApprovalComponentType = keyof typeof ApprovalComponent;
