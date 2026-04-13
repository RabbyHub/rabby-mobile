import { KeyboardAvoidingView, View } from 'react-native';

const mockKeyboardAwareScrollView = function MockKeyboardAwareScrollView() {
  return null;
};

function loadReactNativeViewsModule() {
  jest.resetModules();

  jest.doMock('react-native-keyboard-aware-scroll-view', () => ({
    KeyboardAwareScrollView: mockKeyboardAwareScrollView,
  }));

  return require('./useReactNativeViews') as typeof import('./useReactNativeViews');
}

describe('getViewComponentByAs', () => {
  it('returns the expected component for each supported as value', () => {
    const { getViewComponentByAs } = loadReactNativeViewsModule();

    expect(getViewComponentByAs('View')).toBe(View);
    expect(getViewComponentByAs('KeyboardAvoidingView')).toBe(
      KeyboardAvoidingView,
    );
    expect(getViewComponentByAs('KeyboardAwareScrollView')).toBe(
      mockKeyboardAwareScrollView,
    );
  });

  it('falls back to View for unknown values', () => {
    const { getViewComponentByAs } = loadReactNativeViewsModule();

    expect(getViewComponentByAs('Unknown' as any)).toBe(View);
    expect(getViewComponentByAs()).toBe(View);
  });
});
