import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AutoShrinkAmountTextInput } from '@/components/AutoShrinkAmountTextInput';
import { PerpsGestureSlider } from '@/components/perps/PerpsGestureSlider';
import { SliderBubblePortal } from '../Swap/components/Slider';
import { SwapTokenItem } from '../Swap/components/Token';
import BridgeToken from '../Bridge/components/BridgeToken';

let mockSliderMounts = 0;
let mockSliderUnmounts = 0;

// Component contract only: native view recycling still needs iOS verification.
jest.mock('@/components/perps/PerpsGestureSlider', () => ({
  PerpsGestureSlider: (
    props: React.ComponentProps<typeof PerpsGestureSlider>,
  ) => {
    const ReactModule = require('react');
    const current = ReactModule.useRef(props);
    current.current = props;
    ReactModule.useLayoutEffect(() => {
      mockSliderMounts += 1;
      return () => {
        mockSliderUnmounts += 1;
      };
    }, []);
    ReactModule.useLayoutEffect(() => {
      if (!props.interactive) {
        // The real slider releases an interrupted drag when its native surface
        // detaches as the scene deactivates.
        current.current.onSlidingComplete?.(current.current.value);
      }
    }, [props.interactive]);
    return null;
  },
}));
jest.mock('../Swap/components/Slider', () => ({
  SliderBubblePortal: require('react').forwardRef(() => null),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: () => () => ({}),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/AutoShrinkAmountTextInput', () => ({
  AutoShrinkAmountText: require('react-native').Text,
  AutoShrinkAmountTextInput: require('react-native').TextInput,
}));
jest.mock('@/components2024/CustomSkeleton', () => ({
  CustomSkeleton: () => null,
}));
jest.mock('@/hooks/useAutoFocusInput', () => () => ({
  inputCallbackRef: jest.fn(),
  inputRef: { current: null },
}));
jest.mock('@/utils/chain', () => ({ findChainByEnum: () => undefined }));
jest.mock('@/utils/number', () => ({
  formatTokenAmount: String,
  formatTokenAmountInput: String,
  formatUsdValue: String,
}));
jest.mock('../Swap/utils', () => ({ tokenAmountBn: jest.fn() }));
jest.mock('../Bridge/hooks', () => ({ useBridgeSupportedChains: () => [] }));
jest.mock('../Bridge/components/ChainInfo', () => ({ ChainInfo: () => null }));
jest.mock('../Bridge/components/BridgeToTokenSelect', () => () => null);
jest.mock('../Swap/components/TokenSelect', () => () => null);
jest.mock('../Swap/components/SwapToTokenSelect', () => () => null);
jest.mock('@/assets2024/icons/swap/wallet-cc.svg', () => () => null);
jest.mock('react-native-linear-gradient', () => () => null);

beforeEach(() => {
  mockSliderMounts = 0;
  mockSliderUnmounts = 0;
});

it.each(['swap', 'bridge'] as const)(
  '%s keeps its slider on screen and only releases the drag on deactivation',
  scene => {
    const onChangeSlider = jest.fn();
    const onScrollEnabledChange = jest.fn();
    const element = (sceneActive: boolean) =>
      scene === 'swap' ? (
        <SwapTokenItem
          type="from"
          sceneActive={sceneActive}
          slider={37}
          value="1.23"
          chainId="eth"
          onTokenChange={jest.fn()}
          onChangeSlider={onChangeSlider}
        />
      ) : (
        <BridgeToken
          type="from"
          sceneActive={sceneActive}
          slider={37}
          value="1.23"
          account={null}
          onChangeToken={jest.fn()}
          onChangeChain={jest.fn()}
          onChangeSlider={onChangeSlider}
          onSliderScrollEnabledChange={onScrollEnabledChange}
        />
      );
    const ui = render(element(true));
    const input = ui.UNSAFE_getByType(AutoShrinkAmountTextInput);

    for (let cycle = 0; cycle < 2; cycle++) {
      act(() => {
        ui.UNSAFE_getByType(PerpsGestureSlider).props.onSlidingStart(37);
      });
      expect(ui.UNSAFE_getByType(SliderBubblePortal).props.visible).toBe(true);
      if (scene === 'bridge') {
        expect(onScrollEnabledChange).toHaveBeenLastCalledWith(false);
      }

      ui.rerender(element(false));
      // The track stays visible for the whole pager transition; only the
      // native gesture surface detaches while the scene is inactive.
      expect(ui.UNSAFE_getByType(PerpsGestureSlider).props.interactive).toBe(
        false,
      );
      expect(ui.UNSAFE_getByType(SliderBubblePortal).props.visible).toBe(false);
      expect(mockSliderUnmounts).toBe(0);
      expect(mockSliderMounts).toBe(1);
      expect(onChangeSlider).toHaveBeenLastCalledWith(37, true);
      if (scene === 'bridge') {
        expect(onScrollEnabledChange).toHaveBeenLastCalledWith(true);
      }

      ui.rerender(element(true));
      expect(mockSliderMounts).toBe(1);
      expect(ui.UNSAFE_getByType(PerpsGestureSlider).props.interactive).toBe(
        true,
      );
      expect(ui.UNSAFE_getByType(PerpsGestureSlider).props.value).toBe(37);
      expect(ui.UNSAFE_getByType(SliderBubblePortal).props.visible).toBe(false);
      expect(ui.UNSAFE_getByType(AutoShrinkAmountTextInput)).toBe(input);
      expect(input.props.value).toBe('1.23');
    }
  },
);
