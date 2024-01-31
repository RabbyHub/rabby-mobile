import { RcIconRightCC } from '@/assets/icons/common';
import {
  RcIconSend,
  RcIconReceive,
  RcIconSwap,
  RcIconMore,
  RcIconApproval,
  RcIconGasTopUp,
} from '@/assets/icons/home';
import { BSheetModal } from '@/components';
import TouchableView from '@/components/Touchable/TouchableView';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { toast } from '@/components/Toast';
import { useNavigation } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal/utils';
import { CHAINS_ENUM } from '@debank/common';

export const HomeTopArea = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation();
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => [436], []);

  const actions = [
    {
      title: 'Send',
      Icon: RcIconSend,
      onPress: () => {},
    },
    {
      title: 'Receive',
      Icon: RcIconReceive,
      onPress: () => {
        const id = createGlobalBottomSheetModal({
          name: MODAL_NAMES.SELECT_CHAIN,
          value: CHAINS_ENUM.ETH,
          onChange: (v: CHAINS_ENUM) => {
            navigation.push(RootNames.Receive, {
              params: {
                chain: v,
              },
            });
            removeGlobalBottomSheetModal(id);
          },
        });
      },
    },
    {
      title: 'Swap',
      Icon: RcIconSwap,
      disabled: true,
      onPress: () => {},
    },
    {
      title: 'More',
      Icon: RcIconMore,
      disabled: true,
      onPress: () => {
        bottomSheetModalRef.current?.present();
      },
    },
  ];

  const toastDisabledAction = useCallback(() => {
    toast.show('Coming Soon :)');
  }, []);

  const moreItems = [
    ...actions.slice(0, -1),
    {
      title: 'Approvals',
      Icon: RcIconApproval,
      onPress: () => {},
    },
    {
      title: 'Gas Top Up',
      Icon: RcIconGasTopUp,
      onPress: () => {},
    },
  ];

  return (
    <>
      {/* <ImageBackground
        source={require('@/assets/icons/home/bg.png')}
        resizeMode="contain"
        style={styles.image}> */}
      <View style={styles.container}>
        <View style={styles.group}>
          {actions.map(item => (
            <TouchableView
              style={[styles.action, item.disabled && styles.disabledAction]}
              onPress={item.disabled ? toastDisabledAction : item.onPress}
              key={item.title}>
              <View style={styles.actionIconWrapper}>
                <item.Icon style={styles.actionIcon} />
              </View>
              <Text style={styles.actionText}>{item.title}</Text>
            </TouchableView>
          ))}
        </View>
      </View>
      {/* </ImageBackground> */}

      <BSheetModal ref={bottomSheetModalRef} snapPoints={snapPoints}>
        <BottomSheetView style={styles.list}>
          {moreItems.map(item => (
            <TouchableView
              style={styles.item}
              onPress={item.onPress}
              key={item.title}>
              <item.Icon style={styles.actionIcon} />
              <Text style={styles.itemText}>{item.title}</Text>
              <RcIconRightCC style={styles.chevron} />
            </TouchableView>
          ))}
        </BottomSheetView>
      </BSheetModal>
    </>
  );
};
const getStyles = createGetStyles(colors => ({
  container: {
    padding: 20,
  },
  image: {
    flex: 1,
    justifyContent: 'center',
  },
  group: {
    marginTop: 98,
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  action: {
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledAction: {
    opacity: 0.6,
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 44,
    backgroundColor: colors['neutral-card-2'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    width: 24,
    height: 24,
  },
  actionText: {
    color: colors['neutral-title-1'],
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },

  list: {
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 20,
  },

  item: {
    height: 60,
    paddingHorizontal: 16,
    backgroundColor: colors['neutral-card-2'],
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemText: {
    marginLeft: 12,
    color: colors['neutral-title-1'],
    fontSize: 16,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 'auto',
    width: 16,
    height: 16,
    color: colors['neutral-foot'],
  },
}));
