import { EventEmitter } from 'events';
import pump from 'pump';
// import pump from '../utils/pump';

import { JsonRpcEngine } from 'json-rpc-engine';
import { createEngineStream } from 'json-rpc-middleware-stream';

import createFilterMiddleware from 'eth-json-rpc-filters';
import createSubscriptionManager from 'eth-json-rpc-filters/subscriptionManager';
import providerAsMiddleware from 'eth-json-rpc-middleware/providerAsMiddleware';

import MobilePortStream from './MobilePortStream';
import Port from './Port';
import { setupMultiplex } from '../utils/streams';
import type { Substream } from '@rabby-wallet/object-multiplex/dist/Substream';
import { stringUtils, urlUtils } from '@rabby-wallet/base-utils';

import { createOriginMiddleware } from './middlewares';
import { createSanitizationMiddleware } from './middlewares/SanitizationMiddleware';
import { isKeyringUnlockedSnapshot } from '@/core/serviceApi/keyring';
import getRpcMethodMiddleware, {
  RefLikeObject,
} from './middlewares/RPCMethodMiddleware';
import WebView from 'react-native-webview';
import { BroadcastEvent } from '@/constant/event';
import type { ProviderNetworkState } from '@/core/utils/providerNetworkState';
import { getProviderNetworkState } from '@/core/utils/providerNetworkState';

/**
 * Delay before the readiness beacon is sent, giving the document the
 * navigation is loading time to come up and install its inpage bridge.
 */
const READINESS_BEACON_DELAY = 50;

type BackgroundBridgeOptions = {
  webview: RefLikeObject<WebView | null>;
  webviewIdRef: RefLikeObject<string>;
  urlRef: RefLikeObject<string>;
  titleRef: RefLikeObject<string>;
  iconRef: RefLikeObject<string | undefined>;
  isMainFrame: boolean;
  isFromMobileInnerDapp?: boolean;
};

export class BackgroundBridge extends EventEmitter {
  port: Port;

  #webview: WebView | null;
  #webviewOrigin: string;

  #disconnected: boolean = true;
  get disconnected() {
    return this.#disconnected;
  }
  #webviewIdRef: RefLikeObject<string> = { current: '' };
  #urlRef: RefLikeObject<string> = { current: '' };
  #titleRef: RefLikeObject<string> = { current: '' };
  #iconRef: RefLikeObject<string | undefined> = { current: '' };

  #engine: JsonRpcEngine | null = null;

  #isFromMobileInnerDapp = false;

  /** Last `chainChanged` payload actually delivered to this bridge's page. */
  #lastChainIdSent: string | null = null;
  #lastNetworkVersionSent: string | null = null;

  #readinessBeaconTimer: ReturnType<typeof setTimeout> | null = null;

  get origin() {
    return this.#webviewOrigin;
  }

  get url() {
    return this.#urlRef.current;
  }

  get webviewId() {
    return this.#webviewIdRef.current;
  }

  get isFromMobileInnerDapp() {
    return this.#isFromMobileInnerDapp;
  }

  constructor(options: BackgroundBridgeOptions) {
    super();

    const {
      webview,
      webviewIdRef,
      urlRef,
      titleRef,
      iconRef,
      isMainFrame,
      isFromMobileInnerDapp,
    } = options;

    this.#webview = webview.current;
    this.#webviewIdRef = webviewIdRef;
    this.#webviewOrigin =
      urlRef.current === 'about:rabby'
        ? urlRef.current
        : urlUtils.canoicalizeDappUrl(urlRef.current).httpOrigin;

    this.#urlRef = urlRef;
    this.#titleRef = titleRef;
    this.#iconRef = iconRef;

    this.#isFromMobileInnerDapp = !!isFromMobileInnerDapp;

    this.port = new Port(this.#webview, isMainFrame);

    const portStream = new MobilePortStream(this.port, urlRef);
    // setup multiplexing
    const portMux = setupMultiplex(portStream);
    // connect features
    this._setupProviderConnection(portMux.createStream('rabby-provider'));

    // Readiness beacon, NOT a chain state update (see #935).
    //
    // The inpage bridge treats the first `rabby_chainChanged` it receives as
    // "the background pipeline is up" and replies with
    // `RABBY_EXTENSION_CONNECT_CAN_RETRY`, which makes the stream middleware
    // replay requests that were dropped before the pipeline was wired — on
    // Android an early `rabby_getProviderState` would otherwise hang forever.
    // See `backgroundBridgeStreamMessageListener` in
    // `@rabby-wallet/rn-webview-bridge` (scripts/inpage-bridge/inpage/index.js).
    //
    // Two properties this send has to keep:
    //
    // 1. It must land in the *new* document. The bridge is constructed from
    //    `onLoadStart`, before the navigation commits, so the page that needs
    //    the beacon does not exist yet — hence the delay. Sending it
    //    synchronously injects it into the outgoing document and the retry
    //    never happens. (Deleting this delay needs the bridge to be created
    //    after navigation commit instead.)
    // 2. It must carry exactly the state `rabby_getProviderState` reports,
    //    which is why both read `getProviderNetworkState`. The value is
    //    resolved here rather than inside the timer so the two cannot drift
    //    apart. If they disagree, the inpage provider emits a `chainChanged`
    //    that never happened and dapps wired as
    //    `chainChanged -> location.reload()` reload on every page load.
    //
    // A beacon carrying the value the page already has is harmless: the retry
    // fires on receipt, before and independently of the provider's own
    // de-duplication, so nothing is lost by it being de-duped.
    const networkState = getProviderNetworkState(this.#webviewOrigin);
    this.#lastChainIdSent = networkState.chainId;
    this.#lastNetworkVersionSent = networkState.networkVersion;
    this.#readinessBeaconTimer = setTimeout(() => {
      this.#readinessBeaconTimer = null;
      this.#postChainChanged(networkState);
    }, READINESS_BEACON_DELAY);
  }

  #postChainChanged(params: ProviderNetworkState) {
    this.port.postMessage(
      {
        name: 'rabby-provider',
        data: {
          method: BroadcastEvent.chainChanged,
          params,
        },
      },
      this.#webviewOrigin,
    );
  }

  /**
   * Consulted by {@link Session.pushMessage} before a broadcast reaches this
   * bridge's page. Returning `false` drops the push.
   *
   * Tracks what was last delivered so a `chainChanged` carrying the values the
   * page already holds is never re-sent. Relying only on the inpage provider's
   * own de-dupe is not enough: it cannot de-dupe against a value it has not
   * received yet.
   */
  shouldPushMessage = (event: BroadcastEvent, data: any) => {
    if (event !== BroadcastEvent.chainChanged) {
      return true;
    }

    const chainId = data?.chainId;
    if (typeof chainId !== 'string') {
      // Malformed payload, leave delivery behaviour unchanged.
      return true;
    }
    const networkVersion =
      typeof data?.networkVersion === 'string' ? data.networkVersion : null;

    if (
      this.#lastChainIdSent === chainId &&
      this.#lastNetworkVersionSent === networkVersion
    ) {
      return false;
    }

    this.#lastChainIdSent = chainId;
    this.#lastNetworkVersionSent = networkVersion;

    return true;
  };

  isUnlocked() {
    return isKeyringUnlockedSnapshot();
  }

  onUnlock() {
    // TODO UNSUBSCRIBE EVENT INSTEAD
    if (this.#disconnected) return;

    // this.sendNotification({
    //   method: NOTIFICATION_NAMES.unlockStateChanged,
    //   params: true,
    // });
  }

  onLock() {
    // TODO UNSUBSCRIBE EVENT INSTEAD
    if (this.#disconnected) return;

    // this.sendNotification({
    //   method: NOTIFICATION_NAMES.unlockStateChanged,
    //   params: false,
    // });
  }

  onMessage = (msg: Record<string, any>) => {
    this.port.emit('message', { name: msg.name, data: msg.data });
  };

  onDisconnect = () => {
    this.#disconnected = true;

    // A bridge is torn down at the start of the next navigation, so a beacon
    // still in flight would land in the document the *next* bridge serves,
    // carrying this bridge's (now stale) origin and chain.
    if (this.#readinessBeaconTimer) {
      clearTimeout(this.#readinessBeaconTimer);
      this.#readinessBeaconTimer = null;
    }

    this.port.emit('disconnect', { name: this.port.name, data: null });
  };

  /**
   * @description A method for serving our ethereum provider over a given stream.
   * @param stm
   */
  _setupProviderConnection(portOutStream: Substream) {
    this.#engine = this._setupProviderEngine();

    // setup connection
    const providerStream = createEngineStream({ engine: this.#engine });

    pump(portOutStream, providerStream, portOutStream, (err: any) => {
      // handle any middleware cleanup
      // @ts-expect-error force access _middleware
      this.#engine?._middleware.forEach(mid => {
        if (typeof mid?.destroy === 'function') {
          mid.destroy();
        }
      });
      if (__DEV__ && err) {
        console.warn(
          '[BackgroundBridge::_setupProviderConnection] Error with provider stream conn',
          err,
        );
      }
    });
  }

  /**
   * A method for creating a provider that is safely restricted for the requesting domain.
   **/
  _setupProviderEngine() {
    const origin = this.#webviewOrigin;
    // setup json rpc engine stack
    const engine = new JsonRpcEngine();
    // const { blockTracker, provider } =
    //   Engine.context.NetworkController.getProviderAndBlockTracker();

    // // create filter polyfill middleware
    // const filterMiddleware = createFilterMiddleware({ provider, blockTracker });

    // // create subscription polyfill middleware
    // const subscriptionManager = createSubscriptionManager({
    //   provider,
    //   blockTracker,
    // });
    // subscriptionManager.events.on('notification', (message) =>
    //   engine.emit('notification', message),
    // );

    // metadata
    engine.push(createOriginMiddleware({ urlRef: this.#urlRef }));
    // engine.push(createLoggerMiddleware({ origin }));

    // // filter and subscription polyfills
    // engine.push(filterMiddleware);
    // engine.push(subscriptionManager.middleware);
    // // watch asset

    // user-facing RPC methods
    engine.push(
      getRpcMethodMiddleware({
        hostname: this.#webviewOrigin,
        urlRef: this.#urlRef,
        titleRef: this.#titleRef,
        iconRef: this.#iconRef,
        bridge: this,
      }),
    );

    engine.push(createSanitizationMiddleware());
    // // forward to metamask primary provider
    // engine.push(providerAsMiddleware(provider));
    return engine;
  }

  /**
   * @deprecated
   * @param payload
   */
  sendNotification(payload: { method: string; params?: any }) {
    this.#engine && this.#engine.emit('notification', payload);
  }
}
