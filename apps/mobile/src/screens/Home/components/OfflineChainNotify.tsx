import { openapi } from '@/core/request';
import { offlineChainService, preferenceService } from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { findChainByServerID } from '@/utils/chain';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';
import useAsync from 'react-use/lib/useAsync';
import RcIconTipsCC from '@/assets2024/icons/offlineChain/info-cc.svg';
import RcIconCloseCC from '@/assets2024/icons/offlineChain/close-cc.svg';
import { TouchableOpacity } from 'react-native';
import dayjs from 'dayjs';
import { useCallback, useMemo } from 'react';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { useMockDataForHomeCenterArea } from '../hooks/homeCenterArea';
import { isNonPublicProductionEnv } from '@/constant';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

// const closedTipsChainsAtom = atom(offlineChainService.getCloseTipsChains());
type ClosedTipsState = {
  closedTipsChains: string[];
};
const closedTipsStore = zCreate<ClosedTipsState>(() => ({
  closedTipsChains: offlineChainService.getCloseTipsChains(),
}));

function setClosedTipsChainState(
  valOrFunc: UpdaterOrPartials<ClosedTipsState['closedTipsChains']>,
) {
  closedTipsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.closedTipsChains, valOrFunc);

    offlineChainService.setCloseTipsChains(newVal);

    return { ...prev, closedTipsChains: newVal };
  });
}

const clearOfflineChainTips = () => {
  offlineChainService.mockClearCloseTipsChains();
  setClosedTipsChainState([]);
};

const setClosedTipsChain = (chain: string) => {
  setClosedTipsChainState(p => [...p, chain]);
  offlineChainService.setCloseTipsChains([chain]);
};

export const useMockClearOfflineChainTips = () => {
  return { clearOfflineChainTips };
};

export const useOfflineChain = () => {
  const closedTipsChains = closedTipsStore(s => s.closedTipsChains);
  const { mockData } = useMockDataForHomeCenterArea();
  const { value: offlineList } = useAsync(async () => {
    // leave here for mock data
    if (isNonPublicProductionEnv && mockData.forceShowOffchainNotify) {
      return [
        { id: 'eth', offline_at: dayjs().add(6, 'day').unix() }, // Example data
        { id: 'bsc', offline_at: dayjs().add(6, 'day').unix() }, // Example data
        { id: 'polygon', offline_at: dayjs().add(6, 'day').unix() }, // Example data
      ];
    }

    return openapi.getOfflineChainList();
  }, [mockData.forceShowOffchainNotify]);

  const { balanceAccounts } = useAccountsBalance();

  const list = useMemo(() => {
    const accountChainBalanceList = Object.keys(balanceAccounts).map(
      addr => preferenceService.getAddressBalance(addr)?.chain_list,
    );

    return offlineList
      ?.filter(e => {
        const isIn7days = dayjs
          .unix(e.offline_at)
          .isBefore(dayjs().add(7, 'day'));
        const isExpired = dayjs().isAfter(dayjs.unix(e.offline_at));
        if (!isIn7days || isExpired) {
          return false;
        }

        if (mockData.forceShowOffchainNotify) return true;
        return accountChainBalanceList.some(chainBalance =>
          chainBalance?.some(chain => chain.id === e.id && chain.usd_value > 1),
        );
      })
      .sort((a, b) => a.offline_at - b.offline_at);
  }, [balanceAccounts, offlineList, mockData.forceShowOffchainNotify]);

  const displayWillClosedChain = useMemo(
    () => list?.filter(e => !closedTipsChains?.includes(e.id))?.[0],
    [closedTipsChains, list],
  );

  const offlineChainInfo = useMemo(
    () =>
      displayWillClosedChain?.id
        ? findChainByServerID(displayWillClosedChain?.id)
        : null,
    [displayWillClosedChain?.id],
  );

  return {
    displayWillClosedChain,
    setClosedTipsChain,
    offlineChainInfo,
  };
};

export const OfflineChainNotify = ({
  data,
}: {
  data: ReturnType<typeof useOfflineChain>;
} & RNViewProps) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const {
    displayWillClosedChain,
    setClosedTipsChain,
    offlineChainInfo: chainInfo,
  } = data;

  const handleClose = useCallback(() => {
    if (displayWillClosedChain?.id) {
      setClosedTipsChain(displayWillClosedChain?.id);
    }
  }, [setClosedTipsChain, displayWillClosedChain]);

  const showTips = useCallback(() => {
    if (!chainInfo || !displayWillClosedChain) {
      return;
    }
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: t('page.dashboard.offlineChain.chain', {
        chain: chainInfo.name,
      }),
      sections: [],
      content: (
        <>
          <Text style={styles.tipsDesc}>
            {t('page.dashboard.offlineChain.tips', {
              chain: chainInfo.name,
              date: dayjs
                .unix(displayWillClosedChain.offline_at)
                .format('YYYY/MM/DD'),
            })}
          </Text>
        </>
      ),
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: [350],
      },
      nextButtonProps: {
        title: (
          <Text style={styles.closeModalBtnText}>
            {t('page.tokenDetail.excludeBalanceTipsButton')}
          </Text>
        ),
        titleStyle: styles.title,
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
      },
    });
  }, [
    chainInfo,
    displayWillClosedChain,
    t,
    styles.tipsDesc,
    styles.closeModalBtnText,
    styles.title,
  ]);

  // delegate outer to place empty holder
  if (!displayWillClosedChain || !chainInfo) return null;

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: chainInfo.logo }}
        width={16}
        height={16}
        style={styles.logo}
      />

      <View style={styles.textWrapper}>
        <Text style={styles.text}>
          {t('page.dashboard.offlineChain.chain', {
            chain: chainInfo.name,
          })}
        </Text>
      </View>

      <TouchableOpacity onPress={showTips} style={{ marginLeft: 40 }}>
        <RcIconTipsCC
          color={colors2024['orange-default']}
          width={16}
          height={16}
        />
      </TouchableOpacity>

      <TouchableOpacity style={{ marginLeft: 16 }} onPress={handleClose}>
        <RcIconCloseCC
          color={colors2024['orange-default']}
          width={16}
          height={16}
        />
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginHorizontal: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors2024['orange-light-1'],
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerNone: {
    display: 'none',
  },
  logo: {
    width: 16,
    height: 16,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    position: 'relative',
    top: 1,
  },
  textWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  text: {
    color: colors2024['orange-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
    paddingHorizontal: 4,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    lineHeight: 24,
    marginTop: 5,
  },
  closeModalBtnText: {
    fontSize: 20,
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },

  tipsDesc: {
    paddingTop: 22,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'left',
  },
}));
