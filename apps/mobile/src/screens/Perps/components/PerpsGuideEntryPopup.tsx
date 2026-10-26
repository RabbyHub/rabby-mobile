import React from 'react';
import { Image, View } from 'react-native';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import PerpsGuideLight from '@/assets2024/icons/perps/ImgPerpDetailGuideLight.png';
import PerpsGuideDark from '@/assets2024/icons/perps/ImgPerpDetailGuideDark.png';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
} from '@/constant/layout';

interface Props {
  visible?: boolean;
  onClose?: () => void;
}

export const PerpsGuideEntryPopup: React.FC<Props> = ({ visible, onClose }) => {
  const { styles, isLight } = useTheme2024({
    getStyle,
  });

  const { t } = useTranslation();

  return (
    <TrackedModal
      modalId={MODAL_GATE_IDS.perpsGuideEntry}
      transparent={true}
      visible={!!visible}
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          <Text style={styles.title}>You can find Perps</Text>
          <Text style={styles.title}>👇 here on the Homepage</Text>
          <View style={styles.body}>
            <Image
              source={isLight ? PerpsGuideLight : PerpsGuideDark}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
          <Button
            title={t('page.perpsDetail.guideEntry.gotIt')}
            type="primary"
            containerStyle={styles.buttonContainer}
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
            onPress={() => {
              onClose?.();
            }}
          />
        </View>
      </View>
    </TrackedModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    maxWidth: 352,
    width: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    // marginBottom: 20,
  },
  body: {
    width: '100%',
    // marginBottom: 24,
    alignItems: 'center',
  },
  image: {
    height: 200,
  },
  buttonContainer: {
    width: '100%',
    height: 48,
  },
}));
