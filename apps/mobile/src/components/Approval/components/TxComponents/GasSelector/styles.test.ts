import { ThemeColors, ThemeColors2024 } from '@/constant/theme';
import { Platform } from 'react-native';
import { getStyle } from './styles';

const originalOS = Platform.OS;
const styles = () =>
  getStyle.getStyles({
    classicalColors: ThemeColors.light,
    colors: ThemeColors.light,
    colors2024: ThemeColors2024.light,
    isLight: true,
    safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
  });

afterEach(() => {
  Platform.OS = originalOS;
});

// Geometry contract, not proof of native TextInput measurement. Verify
// empty -> entered -> cleared priority fee on Android in the same build.
describe('custom gas input geometry', () => {
  it('reserves the same line and padding slot for empty and entered Android text', () => {
    Platform.OS = 'android';
    const input = styles().feeInput;
    expect(input.height).toBe(input.lineHeight + 2 * input.paddingVertical);
    expect(input).toMatchObject({
      height: 58,
      includeFontPadding: false,
      textAlignVertical: 'center',
    });
  });

  it('does not change native iOS input sizing', () => {
    Platform.OS = 'ios';
    const input = styles().feeInput;
    expect(input.height).toBeUndefined();
    expect(input.includeFontPadding).toBeUndefined();
    expect(input.textAlignVertical).toBeUndefined();
  });
});
