import { Platform, type TextStyle } from 'react-native';
import {
  cleanSpecialSoloWeightFont,
  FontNames,
  getFontWeightType,
  getRoundedFontStyle,
  RoundedFontStyles,
} from './fonts';

// Unit contracts for business-to-platform style mapping. UIKit/Fabric glyph
// selection still needs native validation; the RN preset provides Platform.
describe('rounded font styles', () => {
  const weights = [
    ['400', 'Regular', '400'],
    ['500', 'Medium', '500'],
    ['700', 'Bold', '700'],
    ['900', 'Heavy', '800'],
  ] as const;

  it.each(weights)(
    'maps business %s to Android %s and iOS %s',
    (businessWeight, androidFace, iosWeight) => {
      expect(getRoundedFontStyle(businessWeight, 'ios')).toEqual({
        fontFamily: 'ui-rounded',
        fontWeight: iosWeight,
      });
      expect(getRoundedFontStyle(businessWeight, 'android')).toEqual({
        fontFamily: `SF-Pro-Rounded-${androidFace}`,
        fontWeight: undefined,
      });
      expect(
        getRoundedFontStyle(
          Number(businessWeight) as TextStyle['fontWeight'],
          'ios',
        ),
      ).toEqual(getRoundedFontStyle(businessWeight, 'ios'));
    },
  );

  it.each(['ios', 'android'] as const)(
    'defaults to regular and preserves existing business weight groups on %s',
    platform => {
      for (const weight of [
        undefined,
        'normal',
        '100',
        '200',
        '300',
      ] as const) {
        expect(getRoundedFontStyle(weight, platform)).toEqual(
          getRoundedFontStyle('400', platform),
        );
      }
      for (const weight of ['bold', '600', '800'] as const) {
        expect(getRoundedFontStyle(weight, platform)).toEqual(
          getRoundedFontStyle('700', platform),
        );
      }
    },
  );

  it('keeps the generic weight classifier unchanged instead of redefining 900 globally', () => {
    expect(getFontWeightType('900')).toMatchObject({
      supertype: 900,
      finalFontWeight: 900,
    });
    expect(getFontWeightType('800')).toMatchObject({
      supertype: 700,
      finalFontWeight: 700,
    });
  });

  it('exports complete static family/weight pairs for raw styles', () => {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    expect(RoundedFontStyles).toEqual({
      regular: getRoundedFontStyle('400', platform),
      medium: getRoundedFontStyle('500', platform),
      bold: getRoundedFontStyle('700', platform),
      heavy: getRoundedFontStyle('900', platform),
    });
    expect(FontNames.sf_pro).toBe(platform === 'ios' ? 'System' : 'Roboto');
  });

  it('does not share mutable results with later calls or static presets', () => {
    const original = { ...RoundedFontStyles.heavy };
    const style = getRoundedFontStyle('900', 'ios');
    style.fontFamily = 'Changed by caller';
    style.fontWeight = '400';
    expect(getRoundedFontStyle('900', 'ios')).toEqual({
      fontFamily: 'ui-rounded',
      fontWeight: '800',
    });
    expect(RoundedFontStyles.heavy).toEqual(original);
  });
});

describe('single-weight font cleanup', () => {
  it.each(['Regular', 'Medium', 'Bold', 'Heavy'])(
    'removes redundant weight only from the Android %s face',
    face => {
      const input = {
        fontFamily: `SF-Pro-Rounded-${face}`,
        fontWeight: '900' as const,
        fontSize: 20,
        color: '#123456',
      };
      expect(cleanSpecialSoloWeightFont(input)).toEqual({
        ...input,
        fontWeight: undefined,
      });
      expect(input.fontWeight).toBe('900');
    },
  );

  it.each(['ui-rounded', 'System', 'Roboto', 'monospace'])(
    'retains explicit weights and object identity for %s',
    fontFamily => {
      const input = { fontFamily, fontWeight: '800' as const };
      expect(cleanSpecialSoloWeightFont(input)).toBe(input);
      expect(input.fontWeight).toBe('800');
    },
  );

  it('accepts absent styles without adding state', () => {
    expect(cleanSpecialSoloWeightFont()).toBeUndefined();
  });
});
