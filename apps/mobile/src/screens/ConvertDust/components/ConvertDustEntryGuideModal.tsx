import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { NewTag } from '../../Home/components/NewTag';
import GuideImg from '@/assets2024/icons/convertDust/convert-guide-light.png';
import GuideImgDark from '@/assets2024/icons/convertDust/convert-guide-dark.png';
import { Image } from 'react-native';

export function ConvertDustEntryGuideModal({
  visible,
  onGotIt,
}: {
  visible: boolean;
  onGotIt: () => void;
}) {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onGotIt}>
      <Pressable style={styles.mask}>
        <Pressable
          style={styles.card}
          onPress={event => event.stopPropagation()}>
          <Text style={styles.title}>
            {t('page.convertDust.entryGuide.title')}
          </Text>

          <View style={styles.preview}>
            <Image
              style={styles.previewImage}
              source={isLight ? GuideImg : GuideImgDark}
            />
          </View>

          <View style={styles.footer}>
            <Button
              type="primary"
              title={t('page.convertDust.entryGuide.button')}
              buttonStyle={styles.button}
              titleStyle={styles.buttonText}
              onPress={onGotIt}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  mask: {
    flex: 1,
    paddingHorizontal: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 352,
    borderRadius: 20,
    paddingTop: 32,
    paddingBottom: 32,
    backgroundColor: colors2024['neutral-bg-0'],
    // backgroundColor: isLight
    //   ? colors2024['neutral-bg-0']
    //   : colors2024['neutral-bg-1'],
    alignItems: 'center',
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  preview: {
    width: '100%',
    aspectRatio: 1133 / 745,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: -24,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 12,
  },
  buttonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
}));
