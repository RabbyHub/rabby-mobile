import React, { useCallback, useContext, useMemo, useRef } from 'react';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useBottomSheetGestureHandlers } from '@gorhom/bottom-sheet';

import WebView, { WebViewProps } from 'react-native-webview';

type BottomSheetWebViewProps = WebViewProps & {};

function checkIsAtTop(yValue: number) {
  'worklet';
  return yValue <= 5;
}

const BottomSheetWebViewComponent = React.forwardRef<
  WebView,
  BottomSheetWebViewProps
>((props: BottomSheetWebViewProps, ref) => {
  const { ...webviewProps } = props;

  const { contentPanGestureHandler } = useBottomSheetGestureHandlers();

  const [isReachTop, setIsReachTop] = React.useState(true);

  const { gesture } = React.useMemo(() => {
    const mGesture = Gesture.Pan()
      .enabled(isReachTop)
      .shouldCancelWhenOutside(false)
      .runOnJS(false)
      .onStart(contentPanGestureHandler.handleOnStart)
      .onChange(contentPanGestureHandler.handleOnChange)
      .onEnd(contentPanGestureHandler.handleOnEnd)
      .onFinalize(contentPanGestureHandler.handleOnFinalize);

    const native = Gesture.Native()
      .shouldActivateOnStart(true)
      .disallowInterruption(true);

    const finalGesture = Gesture.Simultaneous(native, mGesture);

    return {
      gesture: finalGesture,
    };
  }, [
    isReachTop,
    contentPanGestureHandler.handleOnStart,
    contentPanGestureHandler.handleOnChange,
    contentPanGestureHandler.handleOnEnd,
    contentPanGestureHandler.handleOnFinalize,
  ]);

  return (
    <GestureDetector gesture={gesture}>
      <WebView
        scrollEnabled={true}
        nestedScrollEnabled={true}
        {...webviewProps}
        ref={ref}
        onScroll={e => {
          webviewProps?.onScroll?.(e);

          const isReachTop = checkIsAtTop(e.nativeEvent.contentOffset.y);
          setIsReachTop(isReachTop);
        }}
        style={[webviewProps?.style]}
      />
    </GestureDetector>
  );
});

export const BottomSheetWebView = React.memo(BottomSheetWebViewComponent);
BottomSheetWebView.displayName = 'BottomSheetWebView';

export default BottomSheetWebView;
