import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleProp,
  ViewStyle,
  StyleSheet,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { trigger } from 'react-native-haptic-feedback';
import { useTranslation } from 'react-i18next';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import IconPaste from '@/assets2024/icons/common/paste.svg';

interface IProps {
  onPaste: (text: string) => void;
  disableTrigger?: boolean;
  /** @default true */
  cleanClipboardAfterPaste?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PasteButton: React.FC<IProps> = ({
  onPaste,
  style,
  disableTrigger,
  cleanClipboardAfterPaste = false,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const onPressPaste = () => {
    if (!disableTrigger) {
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    Clipboard.getString().then(text => {
      onPaste(text);
      if (cleanClipboardAfterPaste) {
        Clipboard.setString('');
      }
    });
  };
  return (
    <TouchableOpacity
      hitSlop={6}
      onPress={onPressPaste}
      style={StyleSheet.flatten([styles.button, style])}>
      <IconPaste width={16} height={16} color={colors2024['neutral-foot']} />
      <Text style={styles.pasteButtonText}>{t('global.Paste')}</Text>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(ctx => ({
  button: {
    borderWidth: 1,
    borderColor: ctx.colors2024['brand-default'],
    borderRadius: 8,
    width: 85,
    height: 34,
    paddingVertical: 8,
    paddingHorizontal: 11,
    display: 'flex',
    gap: 8,
    flexDirection: 'row',
  },
  pasteButtonText: {
    color: ctx.colors2024['brand-default'],
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
  },
}));

export default PasteButton;
