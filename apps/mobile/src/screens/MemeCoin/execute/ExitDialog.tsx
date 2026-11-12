import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import RcIconWarning from '@/assets2024/memecoin/warning.svg';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_GAP,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import { createGetStyles2024 } from '@/utils/styles';

/** Android back and a tap on the mask both mean Continue. */
export const ExitDialog = ({
  visible,
  onContinue,
  onStop,
}: {
  visible: boolean;
  onContinue: () => void;
  onStop: () => void;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <TrackedModal
      modalId={MODAL_GATE_IDS.memeCoinExitDialog}
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onContinue}>
      <Pressable style={styles.mask} onPress={onContinue}>
        <Pressable style={styles.card}>
          <RcIconWarning width={48} height={48} />
          <Text style={styles.title}>
            {t('page.memeCoin.execute.exitTitle')}
          </Text>
          <View style={styles.bullets}>
            {[
              t('page.memeCoin.execute.exitDesc1'),
              t('page.memeCoin.execute.exitDesc2'),
            ].map(text => (
              <View key={text} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{text}</Text>
              </View>
            ))}
          </View>
          <View style={styles.buttons}>
            <Button
              type="plain"
              title={t('page.memeCoin.execute.stopAndExit')}
              height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
              containerStyle={styles.buttonContainer}
              onPress={onStop}
            />
            <Button
              type="primary"
              title={t('page.memeCoin.execute.continue')}
              height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
              containerStyle={styles.buttonContainer}
              onPress={onContinue}
            />
          </View>
        </Pressable>
      </Pressable>
    </TrackedModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  mask: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  card: {
    width: '100%',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
  },
  title: {
    marginTop: 16,
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
  },
  bullets: {
    alignSelf: 'stretch',
    marginTop: 12,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 4,
    height: 4,
    marginTop: 8,
    marginHorizontal: 10,
    borderRadius: 2,
    backgroundColor: colors2024['neutral-body'],
  },
  bulletText: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-body'],
  },
  buttons: {
    alignSelf: 'stretch',
    marginTop: 20,
    flexDirection: 'row',
    gap: BOTTOM_BUTTON_GAP,
  },
  buttonContainer: {
    flex: 1,
  },
}));
