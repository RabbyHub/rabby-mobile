import { View } from 'react-native';
import { Button } from '../Button';
import { useMemo } from 'react';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { StyleSheet } from 'react-native';

type FooterComponentProps = RNViewProps & {
  onConfirm?: () => Promise<boolean | void> | boolean | void;
  onCancel?: () => void;
  centerGap?: number;
  noCancelButton?: boolean;
  cancelText?: string;
  cancelButtonProps?: React.ComponentProps<typeof Button>;
  confirmText?: string;
  confirmButtonProps?: React.ComponentProps<typeof Button>;
};

export default function FooterComponentForConfirm(props: FooterComponentProps) {
  const {
    style,
    onConfirm,
    onCancel,
    centerGap = 13,
    noCancelButton = false,
    cancelText = 'Cancel',
    cancelButtonProps,
    confirmText = 'Confirm',
    confirmButtonProps,
  } = props;

  const { styles } = useThemeStyles(getStyles);

  const cancelNode = useMemo(() => {
    if (noCancelButton) return null;

    return (
      <Button
        onPress={onCancel}
        title={cancelText}
        type="clear"
        {...cancelButtonProps}
        buttonStyle={[styles.buttonStyle, cancelButtonProps?.buttonStyle]}
        titleStyle={[styles.btnCancelTitle, cancelButtonProps?.titleStyle]}
        containerStyle={[
          styles.btnContainer,
          styles.btnCancelContainer,
          cancelButtonProps?.containerStyle,
        ]}>
        {cancelText}
      </Button>
    );
  }, [styles, cancelText, noCancelButton, onCancel, cancelButtonProps]);

  const confirmNode = useMemo(() => {
    return (
      <Button
        onPress={onConfirm}
        title={confirmText}
        type="danger"
        {...confirmButtonProps}
        buttonStyle={[styles.buttonStyle, confirmButtonProps?.style]}
        titleStyle={[styles.btnConfirmTitle, confirmButtonProps?.titleStyle]}
        containerStyle={[
          styles.btnContainer,
          styles.btnConfirmContainer,
          confirmButtonProps?.containerStyle,
        ]}>
        {confirmText}
      </Button>
    );
  }, [styles, confirmText, onConfirm, confirmButtonProps]);

  const btnNodesCount = [cancelNode, confirmNode].filter(Boolean).length;

  return (
    <View style={[styles.footerWrapper, style]}>
      <View style={[styles.btnGroup]}>
        {cancelNode}
        {btnNodesCount > 1 && (
          <View style={{ width: centerGap, flexShrink: 1 }} />
        )}
        {confirmNode}
      </View>
    </View>
  );
}

const getStyles = createGetStyles(colors => ({
  footerWrapper: { paddingBottom: 26 },

  btnGroup: {
    paddingTop: 20,
    paddingHorizontal: 20,
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 'auto',
    position: 'relative',
  },

  border: {
    height: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors['neutral-bg1'],
    position: 'absolute',
    top: 0,
    left: 0,
  },

  btnContainer: {
    flexShrink: 1,
    display: 'flex',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    maxWidth: '100%',
  },

  buttonStyle: {
    width: '100%',
    height: '100%',
  },
  btnCancelContainer: {
    borderColor: colors['blue-default'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnCancelTitle: {
    color: colors['blue-default'],
    flex: 1,
  },
  btnConfirmContainer: {},
  btnConfirmTitle: {
    color: colors['neutral-title-2'],
    flex: 1,
  },
}));
