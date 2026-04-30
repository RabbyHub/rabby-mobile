import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';

export function ConvertDustStopSheet({
  visible,
  onContinue,
  onStop,
}: {
  visible: boolean;
  onContinue: () => void;
  onStop: () => void;
}) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onContinue}>
      <View style={styles.mask}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {t('page.convertDust.stopSheet.title')}
          </Text>
          <Text style={styles.desc}>
            {t('page.convertDust.stopSheet.desc')}
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.continueButton} onPress={onContinue}>
              <Text
                numberOfLines={1}
                style={[styles.actionText, styles.continueText]}>
                {t('page.convertDust.stopSheet.continue')}
              </Text>
            </Pressable>
            <Pressable style={styles.stopButton} onPress={onStop}>
              <Text
                numberOfLines={1}
                style={[styles.actionText, styles.stopText]}>
                {t('page.convertDust.stopSheet.stop')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
    maxWidth: 352,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 26,
    backgroundColor: colors2024['neutral-bg-1'],
    alignItems: 'center',
  },
  title: {
    color: '#000000',
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
    textAlign: 'center',
  },
  desc: {
    width: 304,
    marginTop: 12,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center',
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  continueButton: {
    width: 150,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    flex: 1,
  },
  stopButton: {
    flex: 1,
    width: 150,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['red-default'],
    shadowColor: 'rgba(112, 132, 255, 0.1)',
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 4,
  },
  actionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  continueText: {
    color: colors2024['neutral-title-1'],
  },
  stopText: {
    color: colors2024['neutral-InvertHighlight'],
  },
}));
