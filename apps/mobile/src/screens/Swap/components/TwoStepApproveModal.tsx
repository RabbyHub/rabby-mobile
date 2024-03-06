import { StyleSheet, Text, View } from 'react-native';
import { SwapModal } from './Modal';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { Button } from '@/components';
import TouchableItem from '@/components/Touchable/TouchableItem';

type ModalProps = {
  open: boolean;
  onCancel: () => void;
};

export const TwpStepApproveModal = (
  props: ModalProps & TwpStepApproveInnerProps,
) => {
  const { open, onCancel } = props;
  return (
    <SwapModal visible={open} onCancel={onCancel}>
      <TwpStepApproveInner {...props} />
    </SwapModal>
  );
};

type TwpStepApproveInnerProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

const TwpStepApproveInner = ({
  onCancel,
  onConfirm,
}: TwpStepApproveInnerProps) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  // const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.textView}>
        <Text numberOfLines={2} style={styles.title}>
          {' '}
          Sign 2 transactions to change allowance
        </Text>
        <Text style={styles.desc}>
          Token USDT requires 2 transactions to change allowance. First you
          would need to reset allowance to zero, and only then set new allowance
          value.
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title={'Proceed with two step approve'}
          // containerStyle={styles.btnC}
          // buttonStyle={styles.confirmStyle}
          titleStyle={styles.confirmTitleStyle}
          onPress={onConfirm}
        />

        <TouchableItem onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableItem>
      </View>
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    marginHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    alignSelf: 'stretch',
    backgroundColor: colors['neutral-bg-1'],
  },
  textView: {
    paddingHorizontal: 20,
  },
  title: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '500',
    width: 'auto',
  },
  desc: {
    marginTop: 16,
    fontSize: 14,
    width: 'auto',
    fontWeight: '400',
  },

  buttonContainer: {
    paddingHorizontal: 20,
    alignSelf: 'stretch',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    marginTop: 20,
  },
  confirmTitleStyle: {
    color: colors['neutral-title-2'],
    fontSize: 15,
    fontWeight: '500',
  },
  cancelText: {
    textAlign: 'center',
    fontSize: 15,
    color: colors['neutral-body'],
    marginTop: 12,
  },
}));
