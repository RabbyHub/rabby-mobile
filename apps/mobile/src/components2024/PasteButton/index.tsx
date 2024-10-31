import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import IconPaste from '@/assets2024/icons/common/paste.svg';

interface IProps {
  onPaste: (text: string) => void;
}

const PasteButton: React.FC<IProps> = ({ onPaste }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const onPressPaste = () => {
    Clipboard.getString().then(text => {
      onPaste(text);
      Clipboard.setString('');
    });
  };
  return (
    <TouchableOpacity hitSlop={6} onPress={onPressPaste} style={styles.button}>
      <IconPaste width={16} height={16} color={colors2024['neutral-foot']} />
      <Text style={styles.pasteButtonText}>Paste</Text>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(ctx => ({
  button: {
    borderWidth: 1,
    borderColor: ctx.colors2024['blue-default'],
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
    color: ctx.colors2024['blue-default'],
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
  },
}));

export default PasteButton;
