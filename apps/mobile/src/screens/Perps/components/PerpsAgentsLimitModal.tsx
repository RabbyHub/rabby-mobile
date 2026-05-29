import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { RcWarningFull } from '@/assets2024/icons/perps';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from '@/components/Typography';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_GAP,
  BOTTOM_BUTTON_TITLE_STYLE,
} from '@/constant/layout';

interface Props {
  visible: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
}

export const PerpsAgentsLimitModal: React.FC<Props> = ({
  visible,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle,
  });

  return (
    <TrackedModal
      modalId={MODAL_GATE_IDS.perpsAgentsLimit}
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          <RcWarningFull />
          <Text style={styles.description}>
            {t('page.perps.deleteAgentModal')}
          </Text>
          <View style={styles.footer}>
            <Button
              type="ghost"
              title={t('global.cancel')}
              onPress={onCancel}
              height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
              titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
              containerStyle={styles.containerStyle}
            />
            <Button
              type="primary"
              title={t('global.confirm')}
              onPress={onConfirm}
              height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
              titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
              containerStyle={styles.containerStyle}
            />
          </View>
        </View>
      </View>
    </TrackedModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    maxWidth: 352,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },

  footer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: BOTTOM_BUTTON_GAP,
  },

  description: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-body'],
    marginBottom: 32,
    marginTop: 12,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  accountContainer: {
    marginHorizontal: 5,
    marginBottom: 28,
    alignSelf: 'stretch',
  },

  containerStyle: {
    // width: '100%',
    // height: 40,
    height: BOTTOM_BUTTON_DOUBLE_HEIGHT,
    flex: 1,
  },
  buttonStyle: {},
}));
