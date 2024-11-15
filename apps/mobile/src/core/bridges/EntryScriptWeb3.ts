import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

class EntryScriptWeb3Cls {
  #entryScriptWeb3Promise = null as Promise<string> | null;

  // Cache InpageBridgeWeb3 so that it is immediately available
  async init() {
    this.#entryScriptWeb3Promise =
      Platform.OS === 'ios'
        ? RNFS.readFile(`${RNFS.MainBundlePath}/InpageBridgeWeb3.js`, 'utf8')
        : RNFS.readFileAssets('custom/InpageBridgeWeb3.js');

    return this.#entryScriptWeb3Promise;
  }
  getPromise() {
    // If for some reason it is not available, get it again
    return this.#entryScriptWeb3Promise;
  }
}

const EntryScriptWeb3 = new EntryScriptWeb3Cls();

export default EntryScriptWeb3;
