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
import { dappService, keyringService, sessionService } from '../services';
import getRpcMethodMiddleware, {
  RefLikeObject,
} from './middlewares/RPCMethodMiddleware';
import WebView from 'react-native-webview';
import { BroadcastEvent } from '@/constant/event';
import { findChain } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';

type BackgroundBridgeOptions = {
  webview: RefLikeObject<WebView | null>;
  webviewIdRef: RefLikeObject<string>;
  urlRef: RefLikeObject<string>;
  titleRef: RefLikeObject<string>;
  iconRef: RefLikeObject<string | undefined>;
  isMainFrame: boolean;
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

  get origin() {
    return this.#webviewOrigin;
  }

  get url() {
    return this.#urlRef.current;
  }

  get webviewId() {
    return this.#webviewIdRef.current;
  }

  constructor(options: BackgroundBridgeOptions) {
    super();

    const { webview, webviewIdRef, urlRef, titleRef, iconRef, isMainFrame } =
      options;

    this.#webview = webview.current;
    this.#webviewIdRef = webviewIdRef;
    this.#webviewOrigin =
      urlRef.current === 'about:rabby'
        ? urlRef.current
        : urlUtils.canoicalizeDappUrl(urlRef.current).httpOrigin;

    this.#urlRef = urlRef;
    this.#titleRef = titleRef;
    this.#iconRef = iconRef;

    this.port = new Port(this.#webview, isMainFrame);

    const portStream = new MobilePortStream(this.port, urlRef);
    // setup multiplexing
    const portMux = setupMultiplex(portStream);
    // connect features
    this._setupProviderConnection(portMux.createStream('rabby-provider'));

    setTimeout(() => {
      const chain =
        findChain({
          enum: dappService.getDapp(this.#webviewOrigin)?.chainId,
        }) ||
        findChain({
          enum: CHAINS_ENUM.ETH,
        });
      if (chain) {
        this.port.postMessage(
          {
            name: 'rabby-provider',
            data: {
              method: BroadcastEvent.chainChanged,
              params: {
                chainId: chain.hex,
                networkVersion: chain.network,
              },
            },
          },
          this.#webviewOrigin,
        );
      }
    }, 50);
  }

  isUnlocked() {
    return keyringService.isUnlocked();
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
