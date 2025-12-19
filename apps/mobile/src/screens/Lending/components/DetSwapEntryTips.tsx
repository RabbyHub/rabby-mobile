import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';

import { Tip } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import IconCloseCC from '@/assets2024/icons/common/close-cc.svg';
import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { IS_ANDROID } from '@/core/native/utils';

interface IProps {
  children: React.ReactNode;
}

type DebtSwapEntryTipsState = {
  isVisible: boolean;
};
const ScreenWidth = Dimensions.get('window').width;

const debtSwapEntryTipsStore = zustandByMMKV<DebtSwapEntryTipsState>(
  '@DebtSwapEntryTip',
  {
    isVisible: true,
  },
  {
    storage: MMKVStorageStrategy.compatJson,
  },
);

function setDebtSwapEntryTipsVisible(valOrFunc: UpdaterOrPartials<boolean>) {
  debtSwapEntryTipsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.isVisible, valOrFunc);

    return { ...prev, isVisible: newVal };
  });
}

const DebtSwapEntryTips: React.FC<IProps> = ({ children }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const [_isVisible, _setIsVisible] = useState(false);
  const isVisible = debtSwapEntryTipsStore(s => s.isVisible);

  useEffect(() => {
    // tip开启的同时开启弹窗会导致tip无法显示，所以需要延迟显示
    const timeout = setTimeout(() => {
      _setIsVisible(isVisible);
    }, 1000);
    return () => {
      clearTimeout(timeout);
    };
  }, [isVisible]);

  const handleClose = useCallback(() => {
    setDebtSwapEntryTipsVisible(false);
    _setIsVisible(false);
  }, []);

  return (
    <Tip
      isVisible={_isVisible}
      contentStyle={styles.contentStyle}
      parentWrapperStyle={styles.parentWrapperStyle}
      onClose={handleClose}
      content={
        <View style={[styles.content, IS_ANDROID && styles.contentAndroid]}>
          <Text style={styles.text}>
            {t('page.Lending.debtSwap.entryTips')}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <IconCloseCC
              width={20}
              height={20}
              color={colors2024['neutral-secondary']}
            />
          </TouchableOpacity>
        </View>
      }>
      {children}
    </Tip>
  );
};

export default DebtSwapEntryTips;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    color: colors2024['red-default'],
  },
  parentWrapperStyle: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
  },
  contentAndroid: {
    width: ScreenWidth - 72,
    flex: 1,
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    height: 'auto',
    flex: 1,
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
  },
  contentStyle: {
    paddingHorizontal: 12,
    paddingRight: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 54,
  },
  closeButton: {
    width: 20,
    height: 20,
  },
}));
