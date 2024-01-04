import { BrowserRuntimePostMessageStream } from './BrowserRuntimePostMessageStream';

describe('BrowserRuntimePostMessageStream', () => {
  beforeEach(() => {
    const addListener = jest.fn();
    const sendMessage = jest.fn().mockImplementation((message) => {
      // Propagate message to all listeners.
      addListener.mock.calls.forEach(([listener]) => {
        setTimeout(() => listener(message));
      });
    });

    Object.assign(global, {
      chrome: undefined,
      browser: {
        runtime: {
          sendMessage,
          onMessage: {
            addListener,
            removeListener: jest.fn(),
          },
        },
      },
    });
  });

  it('throws if browser.runtime.sendMessage is not a function', () => {
    // @ts-expect-error - Invalid function type.
    browser.runtime.sendMessage = undefined;

    expect(
      () => new BrowserRuntimePostMessageStream({ name: 'foo', target: 'bar' }),
    ).toThrow(
      'browser.runtime.sendMessage is not a function. This class should only be instantiated in a web extension.',
    );

    // @ts-expect-error - Invalid function type.
    browser.runtime.sendMessage = 'foo';

    expect(
      () => new BrowserRuntimePostMessageStream({ name: 'foo', target: 'bar' }),
    ).toThrow(
      'browser.runtime.sendMessage is not a function. This class should only be instantiated in a web extension.',
    );

    // @ts-expect-error - Invalid function type.
    browser.runtime = undefined;

    expect(
      () => new BrowserRuntimePostMessageStream({ name: 'foo', target: 'bar' }),
    ).toThrow(
      'browser.runtime.sendMessage is not a function. This class should only be instantiated in a web extension.',
    );

    // @ts-expect-error - Invalid function type.
    browser = undefined;

    expect(
      () => new BrowserRuntimePostMessageStream({ name: 'foo', target: 'bar' }),
    ).toThrow(
      'browser.runtime.sendMessage is not a function. This class should only be instantiated in a web extension.',
    );
  });

  it('supports chrome.runtime', () => {
    const addListener = jest.fn();
    const sendMessage = jest.fn().mockImplementation((message) => {
      // Propagate message to all listeners.
      addListener.mock.calls.forEach(([listener]) => {
        setTimeout(() => listener(message));
      });
    });

    Object.assign(global, {
      browser: undefined,
      chrome: {
        runtime: {
          sendMessage,
          onMessage: {
            addListener,
            removeListener: jest.fn(),
          },
        },
      },
    });

    expect(
      () => new BrowserRuntimePostMessageStream({ name: 'foo', target: 'bar' }),
    ).not.toThrow();
  });

  it('can communicate between streams and be destroyed', async () => {
    // Initialize sender stream
    const streamA = new BrowserRuntimePostMessageStream({
      name: 'a',
      target: 'b',
    });

    // Initialize receiver stream. Multiplies incoming values by 5 and
    // returns them.
    const streamB = new BrowserRuntimePostMessageStream({
      name: 'b',
      target: 'a',
    });

    streamB.on('data', (value) => streamB.write(value * 5));

    // Get a deferred Promise for the result
    const responsePromise = new Promise((resolve) => {
      streamA.once('data', (num) => {
        resolve(Number(num));
      });
    });

    // Write to stream A, triggering a response from stream B
    streamA.write(111);

    expect(await responsePromise).toBe(555);

    const throwingListener = (data: any) => {
      throw new Error(`Unexpected data on stream: ${data}`);
    };

    streamA.once('data', throwingListener);
    streamB.once('data', throwingListener);

    browser.runtime.sendMessage(new Event('message'));

    // Destroy streams and confirm that they were destroyed
    streamA.destroy();
    streamB.destroy();
    expect(streamA.destroyed).toBe(true);
    expect(streamB.destroyed).toBe(true);
  });
});
