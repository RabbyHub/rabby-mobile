import { openapi } from '@/core/request';
import { offlineChainService, preferenceService } from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { findChainByServerID } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { atom, useAtom } from 'jotai';
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

const closedTipsChainsAtom = atom(offlineChainService.getCloseTipsChains());

const useOfflineChain = () => {
  const [closedTipsChains, _setClosedTipsChain] = useAtom(closedTipsChainsAtom);

  const { value: offlineList } = useAsync(() => {
    return openapi.getOfflineChainList();
  }, []);

  const setClosedTipsChain = useCallback(
    (chain: string) => {
      _setClosedTipsChain(p => [...p, chain]);
      offlineChainService.setCloseTipsChains([chain]);
    },
    [_setClosedTipsChain],
  );

  const { balanceAccounts } = useAccountsBalance();

  const list = useMemo(() => {
    const accountChainBalanceList = balanceAccounts.map(
      e => preferenceService.getAddressBalance(e.address)?.chain_list,
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
        return accountChainBalanceList.some(chainBalance =>
          chainBalance?.some(chain => chain.id === e.id && chain.usd_value > 1),
        );
      })
      .sort((a, b) => a.offline_at - b.offline_at);
  }, [balanceAccounts, offlineList]);

  const displayWillClosedChain = useMemo(
    () => list?.filter(e => !closedTipsChains?.includes(e.id))?.[0],
    [closedTipsChains, list],
  );

  return {
    displayWillClosedChain,
    setClosedTipsChain,
  };
};

export const OfflineChainNotify = () => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { displayWillClosedChain, setClosedTipsChain } = useOfflineChain();
  const chainInfo = useMemo(
    () =>
      displayWillClosedChain?.id
        ? findChainByServerID(displayWillClosedChain?.id)
        : null,
    [displayWillClosedChain?.id],
  );
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
  if (!displayWillClosedChain || !chainInfo) {
    return null;
  }
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
        <TouchableOpacity onPress={showTips}>
          <RcIconTipsCC
            color={colors2024['orange-default']}
            width={16}
            height={16}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={handleClose}>
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
    marginTop: 16,
    marginHorizontal: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors2024['orange-light-1'],
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 16,
    height: 16,
    borderRadius: 9999,
  },
  textWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    flex: 1,
  },
  text: {
    color: colors2024['orange-default'],
    fontFamily: 'SF Pro',
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
