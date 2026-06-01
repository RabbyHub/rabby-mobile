import { Button } from '@/components2024/Button';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import { useTheme2024 } from '@/hooks/theme';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import { createGetStyles2024 } from '@/utils/styles';
import { colord } from 'colord';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '@/components/Typography';

export const NoNewAddressesModal = (props: {
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
}) => {
  const { onCancel, visible, onConfirm } = props;
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <TrackedModal
      modalId={MODAL_GATE_IDS.syncExtensionNoNewAddresses}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      visible={visible}
      statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{t('page.syncExtension.noNewAddr')}</Text>
          <Button
            title={t('global.ok')}
            buttonStyle={styles.buttonStyle}
            titleStyle={styles.confirmTitleStyle}
            onPress={onConfirm}
          />
        </View>
      </View>
    </TrackedModal>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  overlay: {
    flex: 1,
    backgroundColor: colord('black').alpha(0.4).toRgbString(),
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    maxWidth: 353,
    width: '100%',
    height: 138,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 20,
    gap: 20,
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },

  buttonStyle: {
    height: 48,
    borderRadius: 100,
  },

  confirmTitleStyle: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
}));
