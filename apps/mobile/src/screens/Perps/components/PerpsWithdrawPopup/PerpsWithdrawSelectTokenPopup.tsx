import { AssetAvatar } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { WITHDRAW_TOKEN_LIST } from '@/constant/perps';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { ITokenItem } from '@/store/tokens';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Typography';

export const PerpsWithdrawSelectTokenPopup: React.FC<{
  onClose?(): void;
  visible?: boolean;
  onSelect?(token: ITokenItem): void;
}> = ({ onClose, visible, onSelect }) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const renderItem = useMemoizedFn(({ item }: { item: ITokenItem }) => {
    return (
      <TouchableOpacity
        style={styles.tokenListItem}
        onPress={() => {
          onSelect?.(item);
          onClose?.();
        }}>
        <View style={styles.box}>
          <AssetAvatar
            size={46}
            chain={item.chain}
            logo={item.logo_url}
            chainSize={18}
          />
          <Text style={styles.text}>{getTokenSymbol(item)}</Text>
        </View>
      </TouchableOpacity>
    );
  });

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      onDismiss={onClose}
      snapPoints={[300]}>
      <AutoLockView style={styles.container}>
        <Text style={styles.title}>
          {t('page.perps.PerpsWithdrawPopup.selectWithdrawToken')}
        </Text>
        <BottomSheetFlatList
          keyboardShouldPersistTaps="handled"
          data={WITHDRAW_TOKEN_LIST as ITokenItem[]}
          style={styles.flatList}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          keyExtractor={item => item.id + item.chain}
        />
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  container: {
    width: '100%',
    paddingBottom: 40,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    marginBottom: 12,
    textAlign: 'center',
  },
  flatList: {
    paddingHorizontal: 16,
  },
  tokenListItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    width: '100%',
    height: 74,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: 16,
  },
  box: { flexDirection: 'row', alignItems: 'center' },
  text: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
    marginLeft: 8,
  },
  divider: {
    height: 8,
  },
}));
