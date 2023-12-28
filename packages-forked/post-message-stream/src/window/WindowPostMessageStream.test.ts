import { WindowPostMessageStream } from './WindowPostMessageStream';

describe('WindowPostMessageStream', () => {
  it('throws if window.postMessage is not a function', () => {
    const originalPostMessage = window.postMessage;
    (window as any).postMessage = undefined;
    expect(
      () => new WindowPostMessageStream({ name: 'foo', target: 'bar' }),
    ).toThrow(
      'window.postMessage is not a function. This class should only be instantiated in a Window.',
    );
    (window as any).postMessage = originalPostMessage;
  });

  it('can communicate between windows and be destroyed', async () => {
    // Initialize sender stream
    const streamA = new WindowPostMessageStream({
      name: 'a',
      target: 'b',
    });

    // Prevent stream A from receiving stream B's synchronization message, to
    // force execution down a particular path for coverage purposes.
    const originalStreamAListener = (streamA as any)._onMessage;
    const streamAListener = (event: MessageEvent) => {
      if (event.data.data === 'SYN') {
        return undefined;
      }
      return originalStreamAListener(event);
    };
    window.removeEventListener('message', originalStreamAListener, false);
    window.addEventListener('message', streamAListener, false);

    // Initialize receiver stream. Multiplies incoming values by 5 and
    // returns them.
    const streamB = new WindowPostMessageStream({
      name: 'b',
      target: 'a',
      // This shouldn't make a difference, it's just for coverage purposes
      targetWindow: window,
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

    // Check that events without e.g. the correct event.source are ignored as
    // expected
    const throwingListener = (data: any) => {
      throw new Error(`Unexpected data on stream: ${data}`);
    };
    streamA.once('data', throwingListener);
    streamB.once('data', throwingListener);
    window.dispatchEvent(new Event('message'));

    // Destroy streams and confirm that they were destroyed
    streamA.destroy();
    streamB.destroy();
    expect(streamA.destroyed).toBe(true);
    expect(streamB.destroyed).toBe(true);
  });

  it('can take targetOrigin as an option', () => {
    const stream = new WindowPostMessageStream({
      name: 'foo',
      target: 'target',
      targetOrigin: '*',
    });
    expect((stream as any)._targetOrigin).toBe('*');
    stream.destroy();
  });
});
