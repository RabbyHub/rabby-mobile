import { WindowPostMessageStream } from './window/WindowPostMessageStream';

describe('BasePostMessageStream', () => {
  let stream: WindowPostMessageStream;

  beforeEach(() => {
    stream = new WindowPostMessageStream({
      name: 'name',
      target: 'target',
    });
  });

  afterEach(() => {
    stream.destroy();
  });

  it('checks logger receiving messages', () => {
    const log = jest.fn();
    stream._setLogger(log);
    (stream as any)._init = true;
    (stream as any)._onData({ data: 123 });
    expect(log).toHaveBeenCalledWith({ data: 123 }, false);
  });

  it('checks logger sending messages', () => {
    const log = jest.fn();
    stream._setLogger(log);
    (stream as any)._init = true;
    (stream as any)._write({ data: 123 }, null, () => undefined);
    expect(log).toHaveBeenCalledWith({ data: 123 }, true);
  });

  it('handles errors thrown when pushing data', async () => {
    await new Promise<void>((resolve) => {
      stream.push = () => {
        throw new Error('push error');
      };

      stream.once('error', (error) => {
        expect(error.message).toBe('push error');
        resolve();
      });

      (stream as any)._init = true;
      (stream as any)._onData({});
    });
  });

  it('does nothing if receiving junk data during synchronization', async () => {
    const _stream: any = stream;

    const spies = [
      jest.spyOn(_stream, 'push').mockImplementation(),
      jest.spyOn(_stream, 'emit').mockImplementation(),
      jest.spyOn(_stream, '_write').mockImplementation(),
      jest.spyOn(_stream, 'uncork').mockImplementation(),
    ];

    _stream._onData({});
    spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
});
