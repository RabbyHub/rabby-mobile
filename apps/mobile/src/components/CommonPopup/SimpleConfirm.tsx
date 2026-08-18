import { useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import type { MODAL_CREATE_PARAMS } from '../GlobalBottomSheetModal/types';
import AutoLockView from '../AutoLockView';

export default function SimpleConfirmInner({
  title,
  description,
  confirmText,
  onConfirm,
}: MODAL_CREATE_PARAMS['SIMPLE_CONFIRM']) {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { bottom } = useSafeAreaInsets();
  const footerStyle = useMemo(
    () => [
      styles.footer,
      { paddingBottom: getBottomButtonBottomOffset(bottom) },
    ],
    [bottom, styles.footer],
  );

  return (
    <AutoLockView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      <View style={footerStyle}>
        <Button
          height={BOTTOM_BUTTON_SINGLE_HEIGHT}
          titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
          title={confirmText}
          onPress={onConfirm}
        />
      </View>
    </AutoLockView>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  container: {
    paddingTop: 8,
  },
  body: {
    paddingHorizontal: 20,
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  description: {
    color: ctx.colors2024['neutral-secondary'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    lineHeight: 20,
    marginTop: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
  },
}));
