import React, { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { CHAINS_ENUM } from '@debank/common';
import { sortBy } from 'lodash';
import type { Account } from '@/types/account';
import type { Chain } from '@/constant/chains';
import { Text } from '@/components/Typography';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { Button } from '@/components2024/Button';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import RcIconArrowCC from '@/assets2024/icons/common/right-cc.svg';
import RcIconCopy from '@/assets2024/singleHome/copy.svg';
import { useTheme2024 } from '@/hooks/theme';
import { useMainnetChainList } from '@/hooks/useChainList';
import { findChainByEnum } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';

const EMPTY_CHAINS: Chain[] = [];

const IconCopySize = 17;
// 200px QR frame: 182 code + 8 padding + 1 border on each side.
const QR_CODE_SIZE = 182;
const CHAIN_LOGO_SIZE = 18;
const SHOWN_CHAIN_COUNT = 3;
// Same pinned order as the extension Receive page.
const PINNED_CHAINS: CHAINS_ENUM[] = [
  CHAINS_ENUM.ETH,
  CHAINS_ENUM.BASE,
  CHAINS_ENUM.ARBITRUM,
  CHAINS_ENUM.OP,
  CHAINS_ENUM.BSC,
];

type ReceiveAddressCardProps = {
  account: Account;
  selectedChain: CHAINS_ENUM | null;
  onSelectChainChange: (chain: CHAINS_ENUM) => void;
  onCopy: () => void;
  safeChains?: Chain[];
  showAddress?: boolean;
  showQr?: boolean;
};

export function ReceiveAddressCard({
  account,
  selectedChain,
  onSelectChainChange,
  onCopy,
  safeChains = EMPTY_CHAINS,
  showAddress = true,
  showQr = true,
}: ReceiveAddressCardProps) {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const isSafe = account.type === KEYRING_TYPE.GnosisKeyring;
  const [addressLayout, setAddressLayout] = useState<{
    address: string;
    firstLineLength: number;
  } | null>(null);
  const firstLineLength =
    addressLayout?.address === account.address
      ? addressLayout.firstLineLength
      : account.address.length - 14;

  const mainnetList = useMainnetChainList();
  const displayChains = useMemo(
    () =>
      sortBy(isSafe ? safeChains : mainnetList, chain => {
        const index = PINNED_CHAINS.indexOf(chain.enum);
        return index === -1 ? PINNED_CHAINS.length : index;
      }),
    [isSafe, safeChains, mainnetList],
  );

  const singleChain = useMemo(() => {
    if (selectedChain) {
      return findChainByEnum(selectedChain);
    }
    return displayChains.length === 1 ? displayChains[0] : null;
  }, [selectedChain, displayChains]);

  const addressSplit = useMemo(() => {
    if (!account?.address) {
      return [];
    }
    const prefix = account.address.slice(0, 8);
    const firstLineMiddle = account.address.slice(8, firstLineLength);
    const secondLineMiddle = account.address.slice(firstLineLength, -6);
    const suffix = account.address.slice(-6);

    return [prefix, firstLineMiddle, secondLineMiddle, suffix];
  }, [account.address, firstLineLength]);
  const handleSelectChain = () => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY,
      value: selectedChain,
      account: account,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
        enablePanDownToClose: true,
      },
      supportChains: isSafe ? safeChains.map(item => item.enum) : undefined,
      titleText: t('page.receiveAddressList.selectChainTitle'),
      onChange: (v: CHAINS_ENUM) => {
        onSelectChainChange(v);
        removeGlobalBottomSheetModal2024(id);
      },
      onClose: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
  };

  const renderChainLogo = (chain: Chain, index = 0) => (
    <View
      key={chain.enum}
      style={[styles.chainLogoRing, index > 0 && styles.chainLogoOverlap]}>
      {chain.isTestnet ? (
        <TestnetChainLogo size={CHAIN_LOGO_SIZE} name={chain.name} />
      ) : (
        <Image
          style={styles.chainLogo}
          source={{ uri: chain.logo }}
          width={CHAIN_LOGO_SIZE}
          height={CHAIN_LOGO_SIZE}
        />
      )}
    </View>
  );

  const restChainCount = displayChains.length - SHOWN_CHAIN_COUNT;
  const chainUI = (
    <View style={styles.selectChainWrapper}>
      {singleChain ? (
        <>
          {renderChainLogo(singleChain)}
          <Text style={styles.selectChainText}>{singleChain.name}</Text>
        </>
      ) : (
        <>
          <View style={styles.chainLogoList}>
            {displayChains.slice(0, SHOWN_CHAIN_COUNT).map(renderChainLogo)}
          </View>
          {restChainCount > 0 && (
            <Text style={styles.selectChainText}>+{restChainCount}</Text>
          )}
        </>
      )}
      <RcIconArrowCC
        width={12}
        height={12}
        color={colors2024['neutral-secondary']}
        style={styles.selectChainArrow}
      />
    </View>
  );

  return (
    <View style={styles.qrCard}>
      <Text style={styles.qrCardHeader}>{t('page.receive.newTitle')}</Text>
      <Button
        titleStyle={styles.selectChainText}
        title={chainUI}
        buttonStyle={styles.selectChain}
        onPress={handleSelectChain}
      />
      <View style={styles.qrCardCode}>
        {account?.address && showQr ? (
          <QRCode value={account.address} size={QR_CODE_SIZE} />
        ) : (
          <View style={styles.qrCodePlaceholder} />
        )}
      </View>

      <View style={styles.addressDetailContainer}>
        {showAddress ? (
          <>
            <View
              style={styles.addressMeasure}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <Text
                key={account.address}
                style={styles.qrCardAddress}
                onTextLayout={({ nativeEvent }) => {
                  const length = nativeEvent.lines[0]?.text.length;
                  if (!length) {
                    return;
                  }

                  setAddressLayout(previous =>
                    previous?.address === account.address &&
                    previous.firstLineLength === length
                      ? previous
                      : { address: account.address, firstLineLength: length },
                  );
                }}>
                <Text style={styles.highlightAddrPart}>
                  {account.address.slice(0, 8)}
                </Text>
                {account.address.slice(8, -14)}
              </Text>
            </View>
            <Pressable style={styles.addressFirstLine} onPress={onCopy}>
              <Text style={styles.qrCardAddress} numberOfLines={1}>
                <Text style={styles.highlightAddrPart}>{addressSplit[0]}</Text>
                {addressSplit[1]}
              </Text>
            </Pressable>
            <View style={styles.addressSecondLine}>
              <Pressable onPress={onCopy}>
                <Text style={styles.qrCardAddress}>
                  {addressSplit[2]}
                  <Text style={styles.highlightAddrPart}>
                    {addressSplit[3]}
                  </Text>
                </Text>
              </Pressable>
              <Pressable
                onPress={onCopy}
                hitSlop={8}
                accessibilityRole="button"
                style={styles.copyAddressButton}
                accessibilityLabel={t('page.receive.copyAddress')}>
                <RcIconCopy width={IconCopySize} height={IconCopySize} />
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.qrCardAddress}>******</Text>
        )}
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  qrCard: {
    alignItems: 'center',
    borderRadius: 16,
    width: '100%',
    paddingTop: 23,
    paddingBottom: 35,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingHorizontal: 30,
  },
  qrCardHeader: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    marginBottom: 6,
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  qrCardCode: {
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 8,
    padding: 8,
    marginBottom: 24,
    backgroundColor: 'white',
  },
  qrCodePlaceholder: {
    width: QR_CODE_SIZE,
    height: QR_CODE_SIZE,
  },
  addressDetailContainer: {
    width: '100%',
    alignItems: 'center',
  },
  addressFirstLine: {
    width: '100%',
  },
  addressMeasure: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    opacity: 0,
  },
  addressSecondLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyAddressButton: {
    width: IconCopySize,
    height: IconCopySize,
  },
  qrCardAddress: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  selectChain: {
    display: 'flex',
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 100,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-4'],
    alignItems: 'center',
    marginBottom: 20,
    width: 'auto',
    height: 'auto',
  },
  selectChainWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chainLogoList: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
  },
  // 1px ring outside the 18px logo; the -4 overlap keeps the design's 16px step.
  chainLogoRing: {
    width: CHAIN_LOGO_SIZE + 2,
    height: CHAIN_LOGO_SIZE + 2,
    borderRadius: (CHAIN_LOGO_SIZE + 2) / 2,
    borderWidth: 1,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-4'],
    overflow: 'hidden',
  },
  chainLogoOverlap: {
    marginLeft: -4,
  },
  chainLogo: {
    width: CHAIN_LOGO_SIZE,
    height: CHAIN_LOGO_SIZE,
    borderRadius: CHAIN_LOGO_SIZE / 2,
  },
  selectChainText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  selectChainArrow: {
    transform: [{ rotate: '90deg' }],
  },
  highlightAddrPart: {
    color: colors2024['neutral-title-1'],
  },
}));
