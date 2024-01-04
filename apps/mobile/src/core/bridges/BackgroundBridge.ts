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
import { urlUtils } from '@rabby-wallet/base-utils';

import {
  createOriginMiddleware,
  // createLoggerMiddleware,
} from './middlewares';
import { createSanitizationMiddleware } from './middlewares/SanitizationMiddleware';
import { keyringService } from '../services';
import getRpcMethodMiddleware from './middlewares/RPCMethodMiddleware';
import WebView from 'react-native-webview';

type BackgroundBridgeOptions = {
  webview: React.MutableRefObject<WebView | null>;
  url: string;
  isMainFrame: boolean;

  isWalletConnect?: boolean;
};

export class BackgroundBridge extends EventEmitter {
  port: Port;

  #webview: WebView | null;
  #webviewOrigin: string;

  #disconnected: boolean = true;
  #url: string;
  #engine: JsonRpcEngine | null = null;

  get url() {
    return this.#url;
  }

  constructor(options: BackgroundBridgeOptions) {
    super();

    const { webview, url, isMainFrame, isWalletConnect } = options;

    this.#webview = webview.current;
    this.#webviewOrigin = urlUtils.canoicalizeDappUrl(url).httpOrigin;

    this.port = new Port(this.#webview, isMainFrame);

    this.#url = url;

    const portStream = new MobilePortStream(this.port, url);
    // setup multiplexing
    const portMux = setupMultiplex(portStream);
    // connect features
    this._setupProviderConnection(
      portMux.createStream(
        isWalletConnect ? 'walletconnect-provider' : 'rabby-provider',
      ),
    );
  }

  isUnlocked() {
    return keyringService.isUnlocked();
  }

  getProviderState() {
    return {
      isUnlocked: this.isUnlocked(),
      ...this.getProviderNetworkState(),
    };
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

  getProviderNetworkState() {
    // WIP: network state
    const result = {
      networkVersion: '',
      chainId: '',
    };
    return result;
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
    // we have no engine, we dont need to setup a provider

    this.#engine = this._setupProviderEngine();

    // // setup connection
    const providerStream = createEngineStream({ engine: this.#engine });

    pump(portOutStream, providerStream, portOutStream, (err: any) => {
      // handle any middleware cleanup
      // @ts-expect-error force access _middleware
      this.#engine?._middleware.forEach(mid => {
        if (mid.destroy && typeof mid.destroy === 'function') {
          mid.destroy();
        }
      });
      if (err) {
        console.log('Error with provider stream conn', err);
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
    engine.push(createOriginMiddleware({ origin }));
    // engine.push(createLoggerMiddleware({ origin }));

    // // filter and subscription polyfills
    // engine.push(filterMiddleware);
    // engine.push(subscriptionManager.middleware);
    // // watch asset

    // user-facing RPC methods
    engine.push(
      getRpcMethodMiddleware({
        hostname: this.#webviewOrigin,
        getProviderState: this.getProviderState.bind(this),
      }),
    );

    engine.push(createSanitizationMiddleware());
    // // forward to metamask primary provider
    // engine.push(providerAsMiddleware(provider));
    return engine;
  }
}
