import {
  initializeProvider,
  shimWeb3,
} from '@rabby-wallet/universal-providers';
import ObjectMultiplex from '@rabby-wallet/object-multiplex';
import * as pump from 'pump';
import { v4 as uuid } from 'uuid';
import MobilePortStream from './MobilePortStream';
import ReactNativePostMessageStream from './ReactNativePostMessageStream';
import { domReadyCall } from './util';
import { hackGoogle } from './google';
import { startCheckRules } from './rule';

const PORT_INPAGE = 'rabby-inpage';
const PORT_CONTENT_SCRIPT = 'rabby-contentscript';

const CHANNEL_PROVIDER = 'rabby-provider';

// Flag that tracks if the inpage provider has been notified that
// the wallet background ready to receive requests and that the
// inpage provider should retry and pending requests it has not
// yet received a response for.
let isConnectSent = false;
// Setup stream for content script communication
const rabbyStream = new ReactNativePostMessageStream({
  name: PORT_INPAGE,
  target: PORT_CONTENT_SCRIPT,
});

// Initialize provider object (window.ethereum)
const rabbyProvider = initializeProvider({
  connectionStream: rabbyStream,
  shouldSendMetadata: false,
  jsonRpcStreamName: CHANNEL_PROVIDER,
  providerInfo: {
    uuid: uuid(),
    name: process.env.RABBY_BUILD_NAME,
    icon: process.env.RABBY_BUILD_ICON,
    rdns: process.env.RABBY_BUILD_APP_ID,
  },
});

function getAppleTouchIcon() {
  const icons = Array.from(
    document.querySelectorAll(
      'link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]',
    ),
  );

  icons.sort((a, b) => {
    const sizeA = a.sizes ? parseInt(a.sizes.toString().split('x')[0]) : 0;
    const sizeB = b.sizes ? parseInt(b.sizes.toString().split('x')[0]) : 0;
    return sizeB - sizeA;
  });

  return icons.length > 0 ? icons[0].href : null;
}

domReadyCall(() => {
  const origin = location.origin;
  let icon =
    getAppleTouchIcon() ||
    document.querySelector('head > meta[itemprop="image"]')?.content ||
    document.querySelector('head > link[rel~="icon"]')?.href;

  if (icon && !/^https?:\/\//.test(icon)) {
    try {
      icon = new URL(icon, origin).href;
    } catch (e) {
      console.error(e);
    }
  }

  const name =
    document.title ||
    document.querySelector('head > meta[name="title"]')?.content ||
    origin;

  rabbyProvider.request({
    method: 'tabCheckin',
    params: { icon, name, origin, userAgent: navigator.userAgent },
  });
});

// Set content script post-setup function
Object.defineProperty(window, '_rabbySetupProvider', {
  value: () => {
    setupProviderStreams();
    delete window._rabbySetupProvider;
  },
  configurable: true,
  enumerable: false,
  writable: false,
});

// notify webview inpage initialization is complete
window.ReactNativeWebView &&
  window.ReactNativeWebView.postMessage(
    JSON.stringify({
      type: 'RabbyContentScript:InpageLoaded',
      payload: {
        time: Date.now(),
      },
    }),
  );

// Functions

/**
 * Setup function called from content script after the DOM is ready.
 */
function setupProviderStreams() {
  // the transport-specific streams for communication between inpage and background
  const pageStream = new ReactNativePostMessageStream({
    name: PORT_CONTENT_SCRIPT,
    target: PORT_INPAGE,
  });
  // create and connect channel muxes
  // so we can handle the channels individually
  const pageMux = new ObjectMultiplex();
  pageMux.setMaxListeners(25);
  pump(pageMux, pageStream, pageMux, err =>
    logStreamDisconnectWarning('Rabby Inpage Multiplex', err),
  );

  // webview -> native
  const appStream = new MobilePortStream({
    name: PORT_CONTENT_SCRIPT,
  });
  appStream.on('data', backgroundBridgeStreamMessageListener);
  const appMux = new ObjectMultiplex();
  appMux.setMaxListeners(25);
  pump(appMux, appStream, appMux, err => {
    logStreamDisconnectWarning('Rabby Background Multiplex', err);
    notifyProviderOfStreamFailure();
  });

  // forward communication across inpage-background for these channels only
  forwardTrafficBetweenMuxes(CHANNEL_PROVIDER, pageMux, appMux);

  // add web3 shim
  shimWeb3(window.ethereum);
}

/**
 * Set up two-way communication between muxes for a single, named channel.
 *
 * @param {string} channelName - The name of the channel.
 * @param {ObjectMultiplex} muxA - The first mux.
 * @param {ObjectMultiplex} muxB - The second mux.
 */
function forwardTrafficBetweenMuxes(channelName, muxA, muxB) {
  const channelA = muxA.createStream(channelName);
  const channelB = muxB.createStream(channelName);
  pump(channelA, channelB, channelA, err =>
    logStreamDisconnectWarning(
      `muxed traffic for channel "${channelName}" failed.`,
      err,
    ),
  );
}

/**
 * Error handler for page to extension stream disconnections
 *
 * @param {string} remoteLabel - Remote stream name
 * @param {Error} err - Stream connection error
 */
function logStreamDisconnectWarning(remoteLabel, err) {
  let warningMsg = `RabbyContentscript - lost connection to ${remoteLabel}`;
  if (err) {
    warningMsg += `\n${err.stack}`;
  }
  console.warn(warningMsg);
  console.error(err);
}

/**
 * The function notifies inpage when the background bridge stream connection is ready. When the
 * 'rabby_chainChanged' method is received from the background bridge, it implies that the
 * background state is completely initialized and it is ready to process method calls.
 * This is used as a notification to replay any pending messages.
 *
 * @param msg - instance of message received
 */
function backgroundBridgeStreamMessageListener(msg) {
  if (!isConnectSent && msg.data.method === 'rabby_chainChanged') {
    isConnectSent = true;
    window.postMessage(
      {
        target: PORT_INPAGE,
        data: {
          name: CHANNEL_PROVIDER,
          data: {
            jsonrpc: '2.0',
            method: 'RABBY_EXTENSION_CONNECT_CAN_RETRY',
          },
        },
      },
      window.location.origin,
    );
  }
}

/**
 * This function must ONLY be called in pump destruction/close callbacks.
 * Notifies the inpage context that streams have failed, via window.postMessage.
 * Relies on @rabby-wallet/object-multiplex and post-message-stream implementation details.
 */
function notifyProviderOfStreamFailure() {
  window.postMessage(
    {
      target: PORT_INPAGE, // the post-message-stream "target"
      data: {
        // this object gets passed to object-multiplex
        name: CHANNEL_PROVIDER, // the object-multiplex channel name
        data: {
          jsonrpc: '2.0',
          method: 'RABBY_STREAM_FAILURE',
        },
      },
    },
    window.location.origin,
  );
}

hackGoogle();
startCheckRules();
