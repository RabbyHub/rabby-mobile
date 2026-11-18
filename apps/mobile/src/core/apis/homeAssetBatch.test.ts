import { createHomeAssetBatchFetcher } from './homeAssetBatch';

it('starts lazily, shares a request within a batch, and does not cache across refreshes', async () => {
  const request = jest.fn(async (addresses: string[]) =>
    addresses.map(id => ({ id, error_code: 0 })),
  );
  const fetch = createHomeAssetBatchFetcher(['0xa', '0xb'], request);
  expect(request).not.toHaveBeenCalled();

  const results = await Promise.all([fetch('0xA'), fetch('0xB')]);
  expect(results.map(item => item.id)).toEqual(['0xa', '0xb']);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(['0xa', '0xb']);

  const nextRefresh = createHomeAssetBatchFetcher(['0xa'], request);
  await nextRefresh('0xa');
  expect(request).toHaveBeenCalledTimes(2);
});
