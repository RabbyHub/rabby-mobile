import { getActionTypeText, getActionTypeTextByType } from '../utils';

jest.mock('@/utils/i18n', () => ({
  __esModule: true,
  default: {
    t: jest.fn((key: string) => `t:${key}`),
  },
}));

describe('Approval Actions utils', () => {
  it.each([
    ['swap', { swap: {} }, 'page.signTx.swap.title'],
    ['crossToken', { crossToken: {} }, 'page.signTx.crossChain.title'],
    [
      'crossSwapToken',
      { crossSwapToken: {} },
      'page.signTx.swapAndCross.title',
    ],
    ['wrapToken', { wrapToken: {} }, 'page.signTx.wrapToken'],
    ['unWrapToken', { unWrapToken: {} }, 'page.signTx.unwrap'],
    ['send', { send: {} }, 'page.signTx.send.title'],
    ['approveToken', { approveToken: {} }, 'page.signTx.tokenApprove.title'],
    [
      'revokeToken',
      { revokeToken: {} },
      'page.signTx.revokeTokenApprove.title',
    ],
    ['sendNFT', { sendNFT: {} }, 'page.signTx.sendNFT.title'],
    ['approveNFT', { approveNFT: {} }, 'page.signTx.nftApprove.title'],
    ['revokeNFT', { revokeNFT: {} }, 'page.signTx.revokeNFTApprove.title'],
    [
      'approveNFTCollection',
      { approveNFTCollection: {} },
      'page.signTx.nftCollectionApprove.title',
    ],
    [
      'revokeNFTCollection',
      { revokeNFTCollection: {} },
      'page.signTx.revokeNFTCollectionApprove.title',
    ],
    [
      'deployContract',
      { deployContract: {} },
      'page.signTx.deployContract.title',
    ],
    ['cancelTx', { cancelTx: {} }, 'page.signTx.cancelTx.title'],
    ['pushMultiSig', { pushMultiSig: {} }, 'page.signTx.submitMultisig.title'],
    ['contractCall', { contractCall: {} }, 'page.signTx.unknownAction'],
    ['revokePermit2', { revokePermit2: {} }, 'page.signTx.revokePermit2.title'],
    ['assetOrder', { assetOrder: {} }, 'page.signTx.assetOrder.title'],
    [
      'permit2BatchRevokeToken',
      { permit2BatchRevokeToken: {} },
      'page.signTx.batchRevokePermit2.title',
    ],
    ['transferOwner', { transferOwner: {} }, 'page.signTx.transferOwner.title'],
    ['swapLimitPay', { swapLimitPay: {} }, 'page.signTx.swapLimitPay.title'],
    ['multiSwap', { multiSwap: {} }, 'page.signTx.swap.title'],
    ['addLiquidity', { addLiquidity: {} }, 'page.signTx.addLiquidity.title'],
  ])('maps %s action data to the expected i18n key', (_name, data, key) => {
    expect(getActionTypeText(data as any)).toBe(`t:${key}`);
  });

  it('uses common title when no earlier action branch matches', () => {
    expect(
      getActionTypeText({ common: { title: 'Common title' } } as any),
    ).toBe('Common title');
  });

  it('falls back to unknown action when action data does not match a known branch', () => {
    expect(getActionTypeText({} as any)).toBe('t:page.signTx.unknownAction');
  });

  it('keeps branch priority stable when multiple action flags are present', () => {
    expect(
      getActionTypeText({
        swap: {},
        send: {},
        common: { title: 'Common title' },
      } as any),
    ).toBe('t:page.signTx.swap.title');
  });

  it.each([
    ['swap_token', 'page.signTx.swap.title'],
    ['cross_token', 'page.signTx.crossChain.title'],
    ['cross_swap_token', 'page.signTx.swapAndCross.title'],
    ['send_token', 'page.signTx.send.title'],
    ['approve_token', 'page.signTx.tokenApprove.title'],
    ['revoke_token', 'page.signTx.revokeTokenApprove.title'],
    ['permit2_revoke_token', 'page.signTx.revokePermit2.title'],
    ['wrap_token', 'page.signTx.wrapToken'],
    ['unwrap_token', 'page.signTx.unwrap'],
    ['send_nft', 'page.signTx.sendNFT.title'],
    ['approve_nft', 'page.signTx.nftApprove.title'],
    ['revoke_nft', 'page.signTx.revokeNFTApprove.title'],
    ['approve_collection', 'page.signTx.nftCollectionApprove.title'],
    ['revoke_collection', 'page.signTx.revokeNFTCollectionApprove.title'],
    ['deploy_contract', 'page.signTx.deployContract.title'],
    ['cancel_tx', 'page.signTx.cancelTx.title'],
    ['push_multisig', 'page.signTx.submitMultisig.title'],
    ['contract_call', 'page.signTx.contractCall.title'],
    ['swap_order', 'page.signTx.assetOrder.title'],
    ['permit2_batch_revoke_token', 'page.signTx.batchRevokePermit2.title'],
    ['transfer_owner', 'page.signTx.transferOwner.title'],
    ['multiSwap', 'page.signTx.swap.title'],
    ['swapLimitPay', 'page.signTx.swapLimitPay.title'],
  ])('maps action type %s to the expected i18n key', (type, key) => {
    expect(getActionTypeTextByType(type)).toBe(`t:${key}`);
  });

  it('falls back to unknown action for unknown action types', () => {
    expect(getActionTypeTextByType('unknown')).toBe(
      't:page.signTx.unknownAction',
    );
  });
});
