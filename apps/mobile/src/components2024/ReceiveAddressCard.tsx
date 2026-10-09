import React, { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import type { Account } from '@/types/account';
import type { Chain, CHAINS_ENUM } from '@/constant/chains';
import { Text } from '@/components/Typography';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { Button } from '@/components2024/Button';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { RcArrowRightCC } from '@/assets/icons/common';
import RcIconCopy from '@/assets2024/singleHome/copy.svg';
import { useTheme2024 } from '@/hooks/theme';
import { findChainByEnum } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';

const EMPTY_CHAINS: Chain[] = [];

const IconCopySize = 17;

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

  const selectedChainInfo = useMemo(() => {
    if (!selectedChain) {
      return null;
    }
    return findChainByEnum(selectedChain);
  }, [selectedChain]);

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

  const safeChainsUI =
    selectedChain || safeChains.length === 1 ? (
      <View style={styles.selectChainWrapper}>
        <Image
          style={styles.selectChianLogo}
          source={{ uri: (selectedChainInfo || safeChains[0])?.logo }}
          width={23}
          height={23}
        />
        <Text style={styles.selectChainText}>
          {(selectedChainInfo || safeChains[0])?.name}
        </Text>
      </View>
    ) : (
      <View
        style={{
          ...styles.selectChainWrapper,
          ...styles.safeSelectChainWrapper,
        }}>
        {safeChains.length > 0 &&
          safeChains
            .slice(0, 5)
            .map(chain => (
              <Image
                style={{ ...styles.selectChianLogo, ...styles.safeChainLogo }}
                source={{ uri: chain.logo }}
                width={23}
                height={23}
                key={chain.serverId}
              />
            ))}
      </View>
    );
  const nonSafeChainUI = selectedChain ? (
    <View style={styles.selectChainWrapper}>
      {selectedChainInfo?.isTestnet ? (
        <TestnetChainLogo
          size={23}
          name={selectedChainInfo.name}
          style={styles.selectChianLogo}
        />
      ) : (
        <Image
          style={styles.selectChianLogo}
          source={{ uri: selectedChainInfo?.logo }}
          width={23}
          height={23}
        />
      )}
      <Text style={styles.selectChainText}>{selectedChainInfo?.name}</Text>
    </View>
  ) : (
    t('page.receive.allEVMChain')
  );

  return (
    <View style={styles.qrCard}>
      <Text style={styles.qrCardHeader}>{t('page.receive.newTitle')}</Text>
      <Button
        titleStyle={styles.selectChainText}
        title={isSafe ? safeChainsUI : nonSafeChainUI}
        buttonStyle={styles.selectChain}
        iconRight={
          <RcArrowRightCC
            width={15}
            height={15}
            color={colors2024['neutral-title-1']}
          />
        }
        onPress={handleSelectChain}
      />
      <View style={styles.qrCardCode}>
        {account?.address && showQr ? (
          <QRCode value={account.address} size={190} />
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
    borderRadius: 30,
    width: '100%',
    paddingTop: 23,
    paddingBottom: 35,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingHorizontal: 30,
  },
  qrCardHeader: {
    fontSize: 17,
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
    borderRadius: 10,
    padding: 8,
    marginBottom: 24,
    backgroundColor: 'white',
  },
  qrCodePlaceholder: {
    width: 190,
    height: 190,
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
    backgroundColor: colors2024['neutral-bg-2'],
    alignItems: 'center',
    marginBottom: 20,
    width: 'auto',
    height: 'auto',
  },
  selectChainWrapper: {
    display: 'flex',
    flexDirection: 'row',
  },
  selectChianLogo: {
    marginRight: 4,
  },
  selectChainText: {
    fontFamily: 'SF Pro',
    fontSize: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  highlightAddrPart: {
    color: colors2024['neutral-title-1'],
  },
  safeChainLogo: {
    borderColor: colors2024['neutral-bg-2'],
    borderWidth: 2,
    marginRight: 0,
    borderRadius: 50,
  },
  safeSelectChainWrapper: {
    gap: -6,
  },
}));
