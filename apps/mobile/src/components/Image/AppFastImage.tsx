import { useRefState } from '@/hooks/common/useRefState';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import FastImage from 'react-native-fast-image';

type FastImageProps = React.ComponentProps<typeof FastImage>;
export default function AppFastImage(
  props: FastImageProps & {
    PlaceholderContent?: React.ReactNode;
    viewProps?: React.ComponentProps<typeof View>;
  },
) {
  const { styles } = useThemeStyles(getStyles);
  const {
    PlaceholderContent,
    viewProps,
    onLoadEnd: propOnLoadEnd,
    onError: propOnError,
    ...rest
  } = props;

  const {
    stateRef: firstLoadedRef,
    state: firstLoaded,
    setRefState,
  } = useRefState(false);
  const onLoadEnd = React.useCallback<
    FastImageProps['onLoadEnd'] & object
  >(() => {
    if (!firstLoadedRef.current) setRefState(true, true);

    propOnLoadEnd?.();
  }, [firstLoadedRef, setRefState, propOnLoadEnd]);

  const onError = React.useCallback<FastImageProps['onError'] & object>(() => {
    if (!firstLoadedRef.current) setRefState(true, true);

    propOnError?.();
  }, [firstLoadedRef, setRefState, propOnError]);

  return (
    <View
      {...viewProps}
      style={[
        styles.container,
        // props.style?.width
        viewProps?.style,
      ]}>
      <FastImage
        {...rest}
        style={StyleSheet.flatten([props.style])}
        onLoadEnd={onLoadEnd}
        onError={onError}
      />
      {PlaceholderContent && !firstLoaded && (
        <View style={styles.placeholder}>{PlaceholderContent}</View>
      )}
    </View>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      position: 'relative',
    },
    placeholder: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
  };
});
