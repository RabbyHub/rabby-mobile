import { StyleSheet } from 'react-native';

it.each([true, false])(
  'limits the font-metrics override to Android=%s',
  android => {
    jest.isolateModules(() => {
      jest.doMock('@/core/native/utils', () => ({ IS_ANDROID: android }));
      const {
        PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE,
      } = require('./perpsProSingleLineInput');
      const original = { fontSize: 28, lineHeight: 36, minHeight: 52 };
      const style = StyleSheet.flatten([
        original,
        PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE,
      ]);
      if (android) {
        expect(style.lineHeight).toBeUndefined();
        expect(style).toMatchObject({
          fontSize: 28,
          minHeight: 52,
          includeFontPadding: false,
          textAlignVertical: 'center',
        });
      } else {
        expect(style).toEqual(original);
      }
    });
  },
);
