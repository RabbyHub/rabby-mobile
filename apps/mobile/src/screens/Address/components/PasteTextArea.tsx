import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import IconPaste from '@/assets/icons/common/paste-cc.svg';
import Clipboard from '@react-native-clipboard/clipboard';
import { toast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { RcIconInnerScanner } from '@/assets/icons/address';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    textAreaInput: {
      width: '100%',
      color: colors['neutral-title1'],
      fontSize: 15,
      textAlignVertical: 'top',
      height: '100%',
    },
    textArea: {
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: 'solid',
      height: 120,
      borderColor: colors['blue-default'],
      backgroundColor: colors['neutral-card1'],
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      position: 'absolute',
      right: 12,
      bottom: 12,
    },
    actionItem: {
      flexDirection: 'row',
      gap: 4,
    },
    actionText: {
      color: colors['neutral-foot'],
      fontSize: 15,
      lineHeight: 18,
    },
    textAreaError: {
      borderColor: colors['red-default'],
    },
    errorText: {
      color: colors['red-default'],
      fontSize: 13,
      marginTop: 12,
      lineHeight: 16,
    },
  });

interface Props {
  style?: StyleProp<ViewStyle>;
  placeholder?: string;
  value?: string;
  onChange?: (text: string) => void;
  error?: string;
}

export const PasteTextArea: React.FC<Props> = ({
  style,
  placeholder,
  value,
  onChange,
  error,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const [isFocus, setIsFocus] = React.useState(false);

  const onPressPaste = React.useCallback(() => {
    Clipboard.getString().then(text => {
      if (!text) {
        return;
      }

      onChange?.(text);
      toast.success(t('page.newAddress.seedPhrase.pastedAndClear'));
      Clipboard.setString('');
    });
  }, [onChange, t]);

  const onPressScan = () => {
    navigate(RootNames.Scanner);
  };

  return (
    <View style={style}>
      <View
        style={StyleSheet.flatten([
          styles.textArea,
          error ? styles.textAreaError : {},
          {
            borderColor: isFocus
              ? colors['blue-default']
              : colors['neutral-line'],
          },
        ])}>
        <TextInput
          onFocus={() => setIsFocus(true)}
          onBlur={() => setIsFocus(false)}
          placeholder={placeholder}
          multiline={true}
          style={styles.textAreaInput}
          placeholderTextColor={colors['neutral-foot']}
          value={value}
          onChangeText={onChange}
        />
        <View style={styles.actions}>
          <TouchableOpacity onPress={onPressScan} style={styles.actionItem}>
            <RcIconInnerScanner
              width={16}
              height={16}
              color={colors['neutral-foot']}
            />
            <Text style={styles.actionText}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onPressPaste} style={styles.actionItem}>
            <IconPaste width={16} height={16} color={colors['neutral-foot']} />
            <Text style={styles.actionText}>Paste</Text>
          </TouchableOpacity>
        </View>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};
