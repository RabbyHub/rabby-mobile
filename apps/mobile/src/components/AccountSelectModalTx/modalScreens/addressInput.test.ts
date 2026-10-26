import {
  normalizeAddressInputAndSyncNativeText,
  normalizeAddressInputBoundaryWhitespace,
} from './addressInput';

const VALID_ADDRESS = '0x341a1fBD51825E5a107DB54cCb3166DeBA145479';

describe('normalizeAddressInputBoundaryWhitespace', () => {
  it.each([
    ` ${VALID_ADDRESS}`,
    `${VALID_ADDRESS} `,
    `\n${VALID_ADDRESS}\n`,
    `\r\n${VALID_ADDRESS}\r\n`,
    `\t${VALID_ADDRESS}\t`,
    ` \t\r\n${VALID_ADDRESS}\n\r\t `,
  ])('removes supported boundary whitespace from a valid address', value => {
    expect(normalizeAddressInputBoundaryWhitespace(value)).toBe(VALID_ADDRESS);
  });

  it('preserves a valid address when no normalization is needed', () => {
    expect(normalizeAddressInputBoundaryWhitespace(VALID_ADDRESS)).toBe(
      VALID_ADDRESS,
    );
  });

  it.each([
    ` \n0x1234\t `,
    ` ${VALID_ADDRESS.slice(0, -1)}Z `,
    ` ${VALID_ADDRESS.slice(0, 12)}\n${VALID_ADDRESS.slice(12)} `,
    ` ethereum:${VALID_ADDRESS} `,
    ` Address: ${VALID_ADDRESS} `,
    ` (${VALID_ADDRESS}) `,
    ' rabby.eth ',
  ])('keeps malformed or non-address input unchanged', value => {
    expect(normalizeAddressInputBoundaryWhitespace(value)).toBe(value);
  });

  it.each([
    `\u00a0${VALID_ADDRESS}\u00a0`,
    `\u200b${VALID_ADDRESS}\u200b`,
    `\ufeff${VALID_ADDRESS}\ufeff`,
    `\u3000${VALID_ADDRESS}\u3000`,
  ])('does not remove unsupported Unicode whitespace', value => {
    expect(normalizeAddressInputBoundaryWhitespace(value)).toBe(value);
  });
});

describe('normalizeAddressInputAndSyncNativeText', () => {
  it('corrects native text immediately when boundary whitespace is removed', () => {
    const setNativeProps = jest.fn();

    expect(
      normalizeAddressInputAndSyncNativeText(`\n${VALID_ADDRESS} `, {
        setNativeProps,
      }),
    ).toBe(VALID_ADDRESS);
    expect(setNativeProps).toHaveBeenCalledTimes(1);
    expect(setNativeProps).toHaveBeenCalledWith({ text: VALID_ADDRESS });
  });

  it.each([
    VALID_ADDRESS,
    ` \n0x1234\t `,
    ` ${VALID_ADDRESS.slice(0, 12)}\n${VALID_ADDRESS.slice(12)} `,
    ' rabby.eth ',
    `\u200b${VALID_ADDRESS}\u200b`,
  ])('does not rewrite native text for unchanged input', value => {
    const setNativeProps = jest.fn();

    expect(
      normalizeAddressInputAndSyncNativeText(value, { setNativeProps }),
    ).toBe(value);
    expect(setNativeProps).not.toHaveBeenCalled();
  });
});
