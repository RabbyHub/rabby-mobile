// this script is injected into webpage's context
import { EventEmitter } from "events";
import { ethErrors, serializeError } from "eth-rpc-errors";
import BroadcastChannelMessage from "./utils/message/broadcastChannelMessage";
import PushEventHandlers from "./pageProvider/pushEventHandlers";
import { domReadyCall, $ } from "./pageProvider/utils";
import ReadyPromise from "./pageProvider/readyPromise";
import DedupePromise from "./pageProvider/dedupePromise";
import { switchChainNotice } from "./pageProvider/interceptors/switchChain";
import { switchWalletNotice } from "./pageProvider/interceptors/switchWallet";
import { getProviderMode, patchProvider } from "./utils/metamask";

declare const __rabby__channelName;
declare const __rabby__isDefaultWallet;
declare const __rabby__uuid;
declare const __rabby__isOpera;

const log = (event, ...args) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `%c [rabby] (${new Date().toTimeString().substr(0, 8)}) ${event}`,
      "font-weight: bold; background-color: #7d6ef9; color: white;",
      ...args
    );
  }
};

export interface Interceptor {
  onRequest?: (data: any) => any;
  onResponse?: (res: any, data: any) => any;
}

interface StateProvider {
  accounts: string[] | null;
  isConnected: boolean;
  isUnlocked: boolean;
  initialized: boolean;
  isPermanentlyDisconnected: boolean;
}

interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}
interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EthereumProvider;
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
  type: "eip6963:announceProvider";
  detail: EIP6963ProviderDetail;
}

interface EIP6963RequestProviderEvent extends Event {
  type: "eip6963:requestProvider";
}

export class EthereumProvider extends EventEmitter {
  chainId: string | null = null;
  selectedAddress: string | null = null;
  /**
   * The network ID of the currently connected Ethereum chain.
   * @deprecated
   */
  networkVersion: string | null = null;
  isRabby = true;
  isMetaMask = true;
  _isRabby = true;

  _isReady = false;
  _isConnected = false;
  _initialized = false;
  _isUnlocked = false;

  _cacheRequestsBeforeReady: any[] = [];
  _cacheEventListenersBeforeReady: [string | symbol, () => any][] = [];

  _state: StateProvider = {
    accounts: null,
    isConnected: false,
    isUnlocked: false,
    initialized: false,
    isPermanentlyDisconnected: false,
  };

  _metamask = {
    isUnlocked: () => {
      return new Promise((resolve) => {
        resolve(this._isUnlocked);
      });
    },
  };

  private _pushEventHandlers: PushEventHandlers;
  private _requestPromise = new ReadyPromise(2);
  private _dedupePromise = new DedupePromise([]);
  private _bcm = new BroadcastChannelMessage(__rabby__channelName);

  constructor({ maxListeners = 100 } = {}) {
    super();
    this.setMaxListeners(maxListeners);
    this.initialize();
    this.shimLegacy();
    this._pushEventHandlers = new PushEventHandlers(this);
  }

  initialize = async () => {
    document.addEventListener(
      "visibilitychange",
      this._requestPromiseCheckVisibility
    );

    this._bcm.connect().on("message", this._handleBackgroundMessage);
    domReadyCall(() => {
      const origin = location.origin;
      let icon =
        ($('head > link[rel~="icon"]') as HTMLLinkElement)?.href ||
        ($('head > meta[itemprop="image"]') as HTMLMetaElement)?.content;

        if (!/^https?:\/\//.test(icon)) {
          try {
            icon = new URL(icon, origin).href
          } catch(e) {
            console.error(e)
          }
        }

      const name =
        document.title ||
        ($('head > meta[name="title"]') as HTMLMetaElement)?.content ||
        origin;

      this._bcm.request({
        method: "tabCheckin",
        params: { icon, name, origin },
      });

      this._requestPromise.check(2);
    });

    try {
      const { chainId, accounts, networkVersion, isUnlocked }: any =
        await this.requestInternalMethods({
          method: "getProviderState",
        });
      if (isUnlocked) {
        this._isUnlocked = true;
        this._state.isUnlocked = true;
      }
      this.chainId = chainId;
      this.networkVersion = networkVersion;
      this.emit("connect", { chainId });
      this._pushEventHandlers.chainChanged({
        chain: chainId,
        networkVersion,
      });

      this._pushEventHandlers.accountsChanged(accounts);
    } catch {
      //
    } finally {
      this._initialized = true;
      this._state.initialized = true;
      this.emit("_initialized");
    }
  };

  private _requestPromiseCheckVisibility = () => {
    if (document.visibilityState === "visible") {
      this._requestPromise.check(1);
    } else {
      this._requestPromise.uncheck(1);
    }
  };

  private _handleBackgroundMessage = ({ event, data }) => {
    log("[push event]", event, data);
    if (this._pushEventHandlers[event]) {
      return this._pushEventHandlers[event](data);
    }

    this.emit(event, data);
  };

  isConnected = () => {
    return true;
  };

  // TODO: support multi request!
  request = async (data) => {
    if (!this._isReady) {
      const promise = new Promise((resolve, reject) => {
        this._cacheRequestsBeforeReady.push({
          data,
          resolve,
          reject,
        });
      });
      return promise;
    }
    return this._dedupePromise.call(data.method, () => this._request(data));
  };

  _request = async (data) => {
    if (!data) {
      throw ethErrors.rpc.invalidRequest();
    }

    this._requestPromiseCheckVisibility();

    return this._requestPromise.call(() => {
      if (data.method !== "eth_call") {
        log("[request]", JSON.stringify(data, null, 2));
      }

      return this._bcm
        .request(data)
        .then((res) => {
          if (data.method !== "eth_call") {
            log("[request: success]", data.method, res);
          }
          return res;
        })
        .catch((err) => {
          if (data.method !== "eth_call") {
            log("[request: error]", data.method, serializeError(err));
          }
          throw serializeError(err);
        });
    });
  };

  requestInternalMethods = (data) => {
    return this._dedupePromise.call(data.method, () => this._request(data));
  };

  // shim to matamask legacy api
  sendAsync = (payload, callback) => {
    if (Array.isArray(payload)) {
      return Promise.all(
        payload.map(
          (item) =>
            new Promise((resolve) => {
              this.sendAsync(item, (err, res) => {
                // ignore error
                resolve(res);
              });
            })
        )
      ).then((result) => callback(null, result));
    }
    const { method, params, ...rest } = payload;
    this.request({ method, params })
      .then((result) => callback(null, { ...rest, method, result }))
      .catch((error) => callback(error, { ...rest, method, error }));
  };

  send = (payload, callback?) => {
    if (typeof payload === "string" && (!callback || Array.isArray(callback))) {
      // send(method, params? = [])
      return this.request({
        method: payload,
        params: callback,
      }).then((result) => ({
        id: undefined,
        jsonrpc: "2.0",
        result,
      }));
    }

    if (typeof payload === "object" && typeof callback === "function") {
      return this.sendAsync(payload, callback);
    }

    let result;
    switch (payload.method) {
      case "eth_accounts":
        result = this.selectedAddress ? [this.selectedAddress] : [];
        break;

      case "eth_coinbase":
        result = this.selectedAddress || null;
        break;

      default:
        throw new Error("sync method doesnt support");
    }

    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result,
    };
  };

  shimLegacy = () => {
    const legacyMethods = [
      ["enable", "eth_requestAccounts"],
      ["net_version", "net_version"],
    ];

    for (const [_method, method] of legacyMethods) {
      this[_method] = () => this.request({ method });
    }
  };

  on = (event: string | symbol, handler: (...args: any[]) => void) => {
    if (!this._isReady) {
      this._cacheEventListenersBeforeReady.push([event, handler]);
      return this;
    }
    return super.on(event, handler);
  };
}

declare global {
  interface Window {
    ethereum: EthereumProvider;
    web3: any;
    rabby: EthereumProvider;
  }
}

const provider = new EthereumProvider();
patchProvider(provider);
let cacheOtherProvider: EthereumProvider | null = null;
const rabbyProvider = new Proxy(provider, {
  deleteProperty: (target, prop) => {
    if (
      typeof prop === "string" &&
      ["on", "isRabby", "isMetaMask", "_isRabby"].includes(prop)
    ) {
      // @ts-ignore
      delete target[prop];
    }
    return true;
  },
});

const requestHasOtherProvider = () => {
  return provider.requestInternalMethods({
    method: "hasOtherProvider",
    params: [],
  });
};

const setRabbyProvider = (isDefaultWallet: boolean) => {
  try {
    Object.defineProperty(window, "ethereum", {
      configurable: !isDefaultWallet,
      enumerable: true,
      set(val) {
        if (val?._isRabby) {
          return;
        }
        requestHasOtherProvider();
        cacheOtherProvider = val;
        return rabbyProvider;
      },
      get() {
        return isDefaultWallet
          ? rabbyProvider
          : cacheOtherProvider
          ? cacheOtherProvider
          : rabbyProvider;
      },
    });
  } catch (e) {
    // think that defineProperty failed means there is any other wallet
    requestHasOtherProvider();
    console.error(e);
    window.ethereum = rabbyProvider;
  }
};

const initOperaProvider = () => {
  window.ethereum = rabbyProvider;
  rabbyProvider._isReady = true;
  window.rabby = rabbyProvider;
  patchProvider(rabbyProvider);
  rabbyProvider.on("rabby:chainChanged", switchChainNotice);
};

const setOtherProvider = (otherProvider: EthereumProvider) => {
  if (window.ethereum === otherProvider) {
    return;
  }
  const existingProvider = Object.getOwnPropertyDescriptor(window, "ethereum");
  if (existingProvider?.configurable) {
    Object.defineProperty(window, "ethereum", {
      value: otherProvider,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } else {
    window.ethereum = otherProvider;
  }
};

const initProvider = (isDefaultWallet: boolean) => {
  rabbyProvider._isReady = true;
  rabbyProvider.on("defaultWalletChanged", switchWalletNotice);
  let finalProvider: EthereumProvider | null = null;

  if (window.ethereum && !window.ethereum._isRabby) {
    requestHasOtherProvider();
    cacheOtherProvider = window.ethereum;
  }

  if (isDefaultWallet || !cacheOtherProvider) {
    finalProvider = rabbyProvider;
    patchProvider(rabbyProvider);
    setRabbyProvider(isDefaultWallet);
    rabbyProvider.on("rabby:chainChanged", switchChainNotice);
  } else {
    finalProvider = cacheOtherProvider;
    setOtherProvider(cacheOtherProvider);
  }
  if (!window.web3) {
    window.web3 = {
      currentProvider: finalProvider,
    };
  }
  window.rabby = rabbyProvider;
};

if (__rabby__isOpera) {
  initOperaProvider();
} else {
  initProvider(!!__rabby__isDefaultWallet);
}

const announceEip6963Provider = (provider: EthereumProvider) => {
  const info: EIP6963ProviderInfo = {
    uuid: __rabby__uuid,
    name: "Rabby Wallet",
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTMwLjk2NDUgMTcuODk1QzMyLjE1NjEgMTUuMjMzIDI2LjI2NTMgNy43OTU5OCAyMC42Mzc2IDQuNjk3NTdDMTcuMDkwMiAyLjI5NzI2IDEzLjM5MzkgMi42MjcwMyAxMi42NDUzIDMuNjgwOTRDMTEuMDAyNCA1Ljk5Mzg2IDE4LjA4NTUgNy45NTM3IDIyLjgyMjUgMTAuMjQwN0MyMS44MDQyIDEwLjY4MyAyMC44NDQ2IDExLjQ3NjYgMjAuMjgwNCAxMi40OTE2QzE4LjUxNDMgMTAuNTYzNiAxNC42MzgyIDguOTAzMzEgMTAuMDkgMTAuMjQwN0M3LjAyNTAxIDExLjE0MTkgNC40Nzc3OSAxMy4yNjY2IDMuNDkzMzEgMTYuNDc1OEMzLjI1NDA5IDE2LjM2OTUgMi45ODkyNCAxNi4zMTA0IDIuNzEwNTkgMTYuMzEwNEMxLjY0NTA1IDE2LjMxMDQgMC43ODEyNSAxNy4xNzQyIDAuNzgxMjUgMTguMjM5N0MwLjc4MTI1IDE5LjMwNTMgMS42NDUwNSAyMC4xNjkxIDIuNzEwNTkgMjAuMTY5MUMyLjkwODEgMjAuMTY5MSAzLjUyNTY0IDIwLjAzNjYgMy41MjU2NCAyMC4wMzY2TDEzLjM5MzkgMjAuMTA4MUM5LjQ0NzM4IDI2LjM2ODkgNi4zMjg1IDI3LjI4NDEgNi4zMjg1IDI4LjM2ODhDNi4zMjg1IDI5LjQ1MzQgOS4zMTI3MSAyOS4xNTk1IDEwLjQzMzIgMjguNzU1MkMxNS43OTcyIDI2LjgxOTggMjEuNTU4NCAyMC43ODc4IDIyLjU0NyAxOS4wNTE0QzI2LjY5ODYgMTkuNTY5NCAzMC4xODc2IDE5LjYzMDYgMzAuOTY0NSAxNy44OTVaIiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfNDEzXzIzOTkpIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjIuODkzNCAxMC4yMzdDMjMuMDg4NCAxMC4xMzc4IDIzLjA1MzMgOS44MjcyMSAyMi45OTUxIDkuNTgxNDVDMjIuODU2NSA4Ljk5NjEyIDIwLjQ2NTYgNi42MzUxMiAxOC4yMjAzIDUuNTc3NjJDMTUuMjMyMiA0LjE3MDI0IDEzLjAxMzUgNC4yMDgyOSAxMi42MDE2IDQuODI5NkMxMy4xNzM3IDYuMTI1MjUgMTYuMDk4MSA3LjMzOTA5IDE5LjE1NDEgOC42MDc1NkMyMC40MzE2IDkuMTM3ODIgMjEuNzMyMiA5LjY3NzYzIDIyLjg5MzQgMTAuMjM3WiIgZmlsbD0idXJsKCNwYWludDFfbGluZWFyXzQxM18yMzk5KSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTE4Ljk0NTggMjMuMDgyQzE4LjMzNjYgMjIuODUxMiAxNy42NTAyIDIyLjYzOTIgMTYuODcyIDIyLjQ0NjRDMTcuNzE5MiAyMC45MzA0IDE3Ljg5NyAxOC42ODYxIDE3LjA5NjkgMTcuMjY3MUMxNS45NzM5IDE1LjI3NTggMTQuNTY0MyAxNC4yMTU4IDExLjI4ODcgMTQuMjE1OEM5LjQ4NzA3IDE0LjIxNTggNC42MzYzNiAxNC44MjI3IDQuNTUwMjQgMTguODcxOUM0LjU0MTI0IDE5LjI5NTQgNC41NDk5NiAxOS42ODM2IDQuNTgwNDcgMjAuMDQwN0wxMy4zODg1IDIwLjEwNDZDMTIuMTk3IDIxLjk5NDcgMTEuMDgxIDIzLjM5NzYgMTAuMTAzNSAyNC40NjUxQzExLjI5ODYgMjQuNzcxMiAxMi4yODE2IDI1LjAyNzQgMTMuMTgzMSAyNS4yNjI1QzE0LjAxNCAyNS40NzkxIDE0Ljc3NTcgMjUuNjc3NiAxNS41NzA1IDI1Ljg4MDZDMTYuNzkzMSAyNC45ODkxIDE3Ljk0MjIgMjQuMDE3MyAxOC45NDU4IDIzLjA4MloiIGZpbGw9InVybCgjcGFpbnQyX2xpbmVhcl80MTNfMjM5OSkiLz4KPHBhdGggZD0iTTMuNDAyODIgMTkuNjM0QzMuNzY0NjcgMjIuNzEgNS41MTI4NSAyMy45MTU1IDkuMDg1MDcgMjQuMjcyM0MxMi42NTczIDI0LjYyOSAxNC43MDY0IDI0LjM4OTcgMTcuNDM0NCAyNC42Mzc5QzE5LjcxMjggMjQuODQ1MiAyMS43NDcyIDI2LjAwNjMgMjIuNTAxOSAyNS42MDVDMjMuMTgxMSAyNS4yNDM5IDIyLjgwMTEgMjMuOTM5MyAyMS44OTIzIDIzLjEwMjRDMjAuNzE0MiAyMi4wMTc0IDE5LjA4MzcgMjEuMjYzMSAxNi4yMTQ3IDIwLjk5NTRDMTYuNzg2NSAxOS40Mjk5IDE2LjYyNjMgMTcuMjM1IDE1LjczODMgMTYuMDQwOEMxNC40NTQ0IDE0LjMxNDEgMTIuMDg0NSAxMy41MzM0IDkuMDg1MDggMTMuODc0NUM1Ljk1MTM5IDE0LjIzMDkgMi45NDg3IDE1Ljc3MzcgMy40MDI4MiAxOS42MzRaIiBmaWxsPSJ1cmwoI3BhaW50M19saW5lYXJfNDEzXzIzOTkpIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfNDEzXzIzOTkiIHgxPSI5LjczMzA5IiB5MT0iMTUuNTM3NyIgeDI9IjMwLjcwNzkiIHkyPSIyMS40ODU4IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiM4Nzk3RkYiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjQUFBOEZGIi8+CjwvbGluZWFyR3JhZGllbnQ+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQxX2xpbmVhcl80MTNfMjM5OSIgeDE9IjI3LjIxNCIgeTE9IjE1LjEyNjIiIHgyPSIxMi4xMDU1IiB5Mj0iLTAuMDA2OTIzMDQiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzNCMjJBMCIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM1MTU2RDgiIHN0b3Atb3BhY2l0eT0iMCIvPgo8L2xpbmVhckdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50Ml9saW5lYXJfNDEzXzIzOTkiIHgxPSIxOS4zNjU3IiB5MT0iMjMuNjE2NyIgeDI9IjQuODUzNTQiIHkyPSIxNS4yODgiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzNCMUU4RiIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM2QTZGRkIiIHN0b3Atb3BhY2l0eT0iMCIvPgo8L2xpbmVhckdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50M19saW5lYXJfNDEzXzIzOTkiIHgxPSIxMS4wMTMiIHkxPSIxNS4zODc0IiB4Mj0iMjAuODM5NyIgeTI9IjI3Ljg3MzIiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzg4OThGRiIvPgo8c3RvcCBvZmZzZXQ9IjAuOTgzODk1IiBzdG9wLWNvbG9yPSIjNUY0N0YxIi8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+Cg==",
    rdns: "io.rabby",
  };

  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({ info, provider }),
    })
  );
};

window.addEventListener<any>(
  "eip6963:requestProvider",
  (event: EIP6963RequestProviderEvent) => {
    announceEip6963Provider(rabbyProvider);
  }
);

announceEip6963Provider(rabbyProvider);

window.dispatchEvent(new Event("ethereum#initialized"));
