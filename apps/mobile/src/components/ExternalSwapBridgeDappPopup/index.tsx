import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Keyboard, Text, TouchableOpacity, View } from 'react-native';
import RcIconCircleWarning from '@/assets2024/icons/common/circle-warning.svg';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import RcIconExternalCC from '@/assets2024/icons/common/external-link-cc.svg';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matomoRequestEvent } from '@/utils/analytics';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';

export const ExternalSwapBridgeDappTips = ({
  dappsAvailable,
}: {
  dappsAvailable?: boolean;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.tipContainer}>
      <Text style={styles.tipTitle} numberOfLines={1}>
        {t('component.externalSwapBrideDappPopup.noQuotesForChain')}
      </Text>
      <Text style={styles.tipDesc}>
        {t('component.externalSwapBrideDappPopup.thirdPartyDappToProceed')}
      </Text>
      <RcIconCircleWarning width={18} height={18} style={styles.tipIcon} />
    </View>
  );
};

type SwapBridgeExternalDappInfo = {
  name: string;
  url: string;
  logo: string;
};

function cleanURL(url: string) {
  return url.replace(/^(https?:\/\/)?(www\.)?/, '');
}

const Item = ({
  name,
  url,
  logo,
  onClose,
  openTab,
}: SwapBridgeExternalDappInfo & {
  onClose: () => void;
  openTab: (url: string) => void;
}) => {
  const openDapp = () => {
    Keyboard.dismiss();
    onClose();
    openTab(url + '?utm_source=rabby');
  };
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity style={styles.item} onPress={openDapp}>
      <Image
        source={{ uri: logo }}
        alt={name}
        width={46}
        height={46}
        borderRadius={16}
      />
      <View
        style={{
          flex: 1,
        }}>
        <Text style={styles.subTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.subDesc} numberOfLines={1}>
          {cleanURL(url)}
        </Text>
      </View>

      <RcIconExternalCC
        width={16}
        height={16}
        color={colors2024['neutral-body']}
        style={{
          marginLeft: 'auto',
        }}
      />
    </TouchableOpacity>
  );
};

const SwapBridgeDappPopupInner = ({
  dappList,
  onClose,
  openTab,
}: {
  dappList: SwapBridgeExternalDappInfo[];
  onClose: () => void;
  openTab: (url: string) => void;
}) => {
  const { bottom } = useSafeAreaInsets();
  const { styles } = useTheme2024({ getStyle });

  return (
    <BottomSheetScrollView
      contentContainerStyle={[
        styles.contentContainerStyle,
        {
          paddingBottom: bottom,
        },
      ]}>
      {dappList.map(e => (
        <Item
          name={e.name}
          logo={e.logo}
          url={e.url}
          key={e.url}
          onClose={onClose}
          openTab={openTab}
        />
      ))}
    </BottomSheetScrollView>
  );
};

export const SwapBridgeDappPopup = ({
  visible,
  onClose,
  dappList,
  openTab,
}: {
  visible: boolean;
  onClose: () => void;
  dappList: SwapBridgeExternalDappInfo[];
  openTab: (url: string) => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { t } = useTranslation();
  const snapPoints = useMemo(() => [402], []);
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      modalRef?.current?.present();
    } else {
      modalRef?.current?.dismiss();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      snapPoints={snapPoints}
      ref={modalRef}
      onDismiss={onClose}
      enableDismissOnClose
      {...makeBottomSheetProps({
        linearGradientType: 'bg1',
        colors: colors2024,
      })}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors2024['neutral-bg-1'],
          paddingBottom: bottom,
        }}>
        <Text style={styles.title}>
          {t('component.externalSwapBrideDappPopup.selectADapp')}
        </Text>
        <SwapBridgeDappPopupInner
          dappList={dappList}
          onClose={onClose}
          openTab={openTab}
        />
      </View>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(ctx => ({
  title: {
    color: ctx.colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 24,
    paddingBottom: 24,
  },
  contentContainerStyle: {
    paddingHorizontal: 20,
    gap: 12,
  },
  tipContainer: {
    backgroundColor: ctx.colors2024['orange-light-1'],
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingLeft: 42,
    gap: 4,
    marginTop: 16,
  },
  tipTitle: {
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
  },
  tipDesc: {
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '400',
  },
  tipIcon: {
    position: 'absolute',
    left: 16,
    top: 8,
  },

  item: {
    height: 78,
    padding: 16,
    paddingRight: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: ctx.colors2024['neutral-line'],
    gap: 8,
  },

  subTitle: {
    color: ctx.colors2024['neutral-title-1'],

    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  subDesc: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 20,
  },
}));
