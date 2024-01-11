import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

const EntryScriptWeb3 = {
  entryScriptWeb3: null as string | null,
  // Cache InpageBridgeWeb3 so that it is immediately available
  async init() {
    this.entryScriptWeb3 =
      Platform.OS === 'ios'
        ? await RNFS.readFile(
            `${RNFS.MainBundlePath}/InpageBridgeWeb3.js`,
            'utf8',
          )
        : await RNFS.readFileAssets('custom/InpageBridgeWeb3.js');

    return this.entryScriptWeb3;
  },
  async get() {
    // Return from cache
    if (this.entryScriptWeb3) {
      return this.entryScriptWeb3;
    }

    // If for some reason it is not available, get it again
    return await this.init();
  },
};

export default EntryScriptWeb3;
