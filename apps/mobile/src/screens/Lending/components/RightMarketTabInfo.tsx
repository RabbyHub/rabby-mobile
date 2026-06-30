import React, { useCallback } from 'react';

import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import MaskedView from '@react-native-masked-view/masked-view';
import LightingIcon from '@/assets2024/icons/lending/lighting.svg';
import SettingIconCC from '@/assets2024/icons/lending/setting.svg';
import LightingIconCC from '@/assets2024/icons/lending/lighting-cc.svg';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';

import IsolatedTag from './IsolatedTag';
import { useMode } from '../hooks/useMode';
import { Text } from '@/components/Typography';

const EnabledEmodeInfo = ({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  return (
    <Pressable style={styles.border} onPress={onPress}>
      <LinearGradient
        pointerEvents="none"
        colors={['#2FE0FF', '#D06BFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.borderGradient}
      />
      <View style={[styles.inner, styles.enabledInner]}>
        <LightingIcon width={18} height={18} />
        {Platform.OS === 'android' ? (
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.text}>
            {title}
          </Text>
        ) : (
          <MaskedView
            maskElement={
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.text}>
                {title}
              </Text>
            }>
            <LinearGradient
              colors={['#2FE0FF', '#D06BFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.text, styles.opacity0]}>
                {title}
              </Text>
            </LinearGradient>
          </MaskedView>
        )}
        <SettingIconCC
          width={18}
          height={18}
          color={colors2024['neutral-foot']}
        />
      </View>
    </Pressable>
  );
};

const DisabledEmodeInfo = ({ onPress }: { onPress: () => void }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  return (
    <Pressable style={[styles.inner, styles.disabledInner]} onPress={onPress}>
      <LightingIconCC
        width={18}
        height={18}
        color={colors2024['neutral-secondary']}
      />
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.disabledText}>
        {t('page.Lending.disabled')}
      </Text>
      <SettingIconCC
        width={18}
        height={18}
        color={colors2024['neutral-foot']}
      />
    </Pressable>
  );
};

const RightMarketTabInfo = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { isInIsolationMode, currentEmode, emodeEnabled, eModes } = useMode();

  const handlePressEnabledEmode = useCallback(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: emodeEnabled
        ? MODAL_NAMES.DISABLE_EMODE_OVERVIEW
        : MODAL_NAMES.MANAGE_EMODE,
      allowAndroidHarewareBack: true,
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
    });
  }, [emodeEnabled]);

  if (isInIsolationMode) {
    return (
      <View style={[styles.container, styles.endFlow]}>
        <Text style={styles.emodeLabel} />
        <IsolatedTag isGlobal />
      </View>
    );
  }
  if (emodeEnabled) {
    return (
      <View style={styles.container}>
        <View style={styles.emodeContainer}>
          <Text style={styles.emodeLabel}>
            {t('page.Lending.manageEmode.emode')}
          </Text>
          <EnabledEmodeInfo
            title={currentEmode?.label || ''}
            onPress={handlePressEnabledEmode}
          />
        </View>
      </View>
    );
  }
  if (Object.keys(eModes).length === 1 && eModes[0]?.assets?.length === 0) {
    return null;
  }
  return (
    <View style={styles.container}>
      <View style={styles.emodeContainer}>
        <Text style={styles.emodeLabel}>
          {t('page.Lending.manageEmode.emode')}
        </Text>
        <DisabledEmodeInfo onPress={handlePressEnabledEmode} />
      </View>
    </View>
  );
};

export default RightMarketTabInfo;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 0,
    justifyContent: 'space-between',
  },
  endFlow: {
    justifyContent: 'flex-end',
    flexDirection: 'row',
  },
  emodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    gap: 4,
  },
  emodeLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  emodeValue: {
    fontSize: 12,
    lineHeight: 16,
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  enabledEmodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  border: {
    padding: 1,
    borderRadius: 6,
    height: 32,
    overflow: 'hidden',
  },
  borderGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
  },
  inner: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 6,
    paddingHorizontal: 6,
    justifyContent: 'center',
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  enabledInner: {
    borderRadius: 5,
  },
  disabledInner: {
    backgroundColor: colors2024['neutral-line'],
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors2024['brand-default'],
  },
  disabledText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  opacity0: {
    opacity: 0,
  },
}));
