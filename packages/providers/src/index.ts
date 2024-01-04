import { BaseProvider } from './BaseProvider';
import {
  announceProvider as eip6963AnnounceProvider,
  requestProvider as eip6963RequestProvider,
  EIP6963AnnounceProviderEvent,
  EIP6963ProviderDetail,
  EIP6963ProviderInfo,
  EIP6963RequestProviderEvent,
} from './EIP6963';
import {
  initializeProvider,
  setGlobalProvider,
} from './initializeInpageProvider';
import {
  RabbyInpageProvider,
  RabbyInpageProviderStreamName,
} from './RabbyInpageProvider';
import { shimWeb3 } from './shimWeb3';
import { StreamProvider } from './StreamProvider';

export type {
  EIP6963AnnounceProviderEvent,
  EIP6963ProviderDetail,
  EIP6963ProviderInfo,
  EIP6963RequestProviderEvent,
};

export {
  BaseProvider,
  initializeProvider,
  RabbyInpageProviderStreamName,
  RabbyInpageProvider,
  setGlobalProvider,
  shimWeb3,
  StreamProvider,
  eip6963AnnounceProvider,
  eip6963RequestProvider,
};
