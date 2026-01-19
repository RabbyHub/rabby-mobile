import { CHAINS_ENUM } from '@/constant/chains';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { SelectSortedChainProps } from '@/components2024/SelectChainWithSummary';
import { useFindChain } from '@/hooks/useFindChain';
import React, { useCallback } from 'react';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import {
  MODAL_ID,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import { useTranslation } from 'react-i18next';
import { Account } from '@/core/services/preference';
import { ChainSelector } from '@/screens/Home/components/AssetRenderItems/SectionHeaders';

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    chainSelector: {
      backgroundColor: colors2024['brand-light-1'],
      borderColor: colors2024['brand-disable'],
      borderRadius: 8,
      borderWidth: 1,
    },
  };
});

export function InnerModalChainInfo({
  chainEnum,
  onChange,
  top3Chains,
  disabledTips,
  account,
}: React.PropsWithChildren<
  RNViewProps & {
    top3Chains?: string[];
    chainEnum?: CHAINS_ENUM;
    onChange?: (chain?: CHAINS_ENUM) => void;
    disabledTips?: SelectSortedChainProps['disabledTips'];
    account?: Account | null;
  }
>) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const chainItem = useFindChain({
    enum: chainEnum,
  });

  const modalRef = React.useRef<MODAL_ID>();

  const removeChainModal = React.useCallback(() => {
    if (modalRef.current) {
      removeGlobalBottomSheetModal2024(modalRef.current);
    }
  }, []);

  const createChainModal = React.useCallback(() => {
    removeChainModal();
    if (!account) {
      return;
    }
    modalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY,
      account,
      value: chainEnum,
      onClose: removeChainModal,
      disabledTips,
      hideTestnetTab: true,
      titleText: t('page.swap.selectChainModalTitle'),
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
      },
      onChange: chain => {
        removeChainModal();
        onChange?.(chain);
      },
    });
  }, [account, chainEnum, removeChainModal, disabledTips, t, onChange]);

  const onChainClick = useCallback(
    (clear: boolean) => {
      if (clear) {
        onChange?.(undefined);
      } else {
        createChainModal();
      }
    },
    [createChainModal, onChange],
  );

  return (
    <ChainSelector
      top3Chains={top3Chains}
      style={styles.chainSelector}
      onChainClick={onChainClick}
      chainServerId={chainItem?.serverId}
    />
  );
}
