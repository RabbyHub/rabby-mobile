import { chaintable } from './index';

const mockPost = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({ post: (...args: unknown[]) => mockPost(...args) }),
  },
}));

const respond = (data: object, code = 0) => ({
  data: { code, message: code ? 'bad request' : 'ok', data },
});
const success = (result: unknown) =>
  respond({ success: true, result, error: null });
const failure = (error: string) =>
  respond({ success: false, result: null, error });

describe('chaintable', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('posts the function id with positional arguments and unwraps the result', async () => {
    mockPost.mockResolvedValue(success({ tokens: [] }));
    await expect(chaintable.getMemeTokenList({ page: 2 })).resolves.toEqual({
      tokens: [],
    });
    expect(mockPost).toHaveBeenCalledWith('/v1/function/invoke', {
      id: 'meme_coin.token_list',
      arguments: [null, 2, null],
    });
  });

  it('calls the holdings and P&L functions with the address', async () => {
    mockPost.mockResolvedValue(success({}));
    await chaintable.getMemeUserTokenList('0xabc');
    await chaintable.getMemeUserPnl('0xabc');
    expect(mockPost.mock.calls.map(([, body]) => body)).toEqual([
      { id: 'meme_coin.user.token_list', arguments: ['0xabc'] },
      { id: 'meme_coin.user.pnl', arguments: ['0xabc'] },
    ]);
  });

  it('throws the function error without retrying', async () => {
    mockPost.mockResolvedValue(failure('invalid owner'));
    await expect(chaintable.getMemeUserPnl('nope')).rejects.toThrow(
      'invalid owner',
    );
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('throws when the envelope code is not 0', async () => {
    mockPost.mockResolvedValue(respond({}, 400));
    await expect(chaintable.invoke('any')).rejects.toThrow('bad request');
  });

  it('does not retry a request error', async () => {
    mockPost.mockRejectedValue(new Error('Request failed with status 429'));
    await expect(chaintable.invoke('any')).rejects.toThrow('429');
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('retries once when the call hits the server deadline', async () => {
    mockPost
      .mockResolvedValueOnce(failure('call deadline exceeded'))
      .mockResolvedValueOnce(success(1));
    await expect(chaintable.invoke('any')).resolves.toBe(1);
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('gives up after the second deadline', async () => {
    mockPost.mockResolvedValue(failure('call deadline exceeded'));
    await expect(chaintable.invoke('any')).rejects.toThrow(
      'call deadline exceeded',
    );
    expect(mockPost).toHaveBeenCalledTimes(2);
  });
});
