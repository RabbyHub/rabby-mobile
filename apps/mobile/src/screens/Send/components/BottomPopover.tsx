import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcIconCloseCC from '@/assets/icons/common/icon-close-cc.svg';
import { useTranslation } from 'react-i18next';

interface IProps {
  onClose: () => void;
}
const BottomPopover = ({ onClose }: IProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={[styles.arrow]} />
      <View style={[styles.bubble]}>
        <Text style={styles.qrCardAddress}>
          {t('page.confirmAddress.tipForWhiteList')}
        </Text>
        <Pressable onPress={onClose}>
          <RcIconCloseCC style={styles.icon} />
        </Pressable>
      </View>
    </View>
  );
};

export default BottomPopover;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 18,
    width: '100%',
  },
  bubble: {
    borderRadius: 12,
    backgroundColor: colors2024['neutral-black'],
    borderColor: colors2024['neutral-line'],
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrCardAddress: {
    // width: '100%',
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-InvertHighlight'],
  },
  icon: {
    width: 14,
    height: 14,
    color: colors2024['neutral-secondary'],
  },
  highlightAddrPart: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  arrow: {
    position: 'absolute',
    top: -8,
    right: '3%',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-black'],
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 999,
  },
}));
