import { sendRequest } from '@/core/apis/sendRequest';
import {
  builtinEthereumProvider,
  setEthereumProviderSendRequestHandler,
} from './ethereumProvider';
import { setGlobalProvider } from './globalProvider';

setEthereumProviderSendRequestHandler(sendRequest);

const buildinProvider = {
  currentProvider: new Proxy(builtinEthereumProvider, {
    deleteProperty: () => true,
  }),
};
setGlobalProvider(buildinProvider);

export { EthereumProvider } from './ethereumProvider';

export default buildinProvider;
