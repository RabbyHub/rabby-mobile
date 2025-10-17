import React, { useEffect, useMemo, useState } from 'react';
import { View, SectionList, Text } from 'react-native';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { AddressItemEntry } from './components/AddressItem';
import { KeyringTypeName, KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { createGetStyles2024 } from '@/utils/styles';
import { useSortAddressList } from './useSortAddressList';
import HelpIcon from '@/assets2024/icons/common/help.svg';
import { Card } from '@/components2024/Card';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import PlusSVG from '@/assets2024/icons/common/plus-cc.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccountInfo } from './components/MultiAssets/hooks';
import { useTranslation } from 'react-i18next';
import AutoLockView from '@/components/AutoLockView';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { TouchableOpacity } from 'react-native';
import { createGlobalBottomSheetModal2024 } from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { IS_IOS } from '@/core/native/utils';

export const NotMatterAddressDialog: React.FC<{
  onDone: () => void;
}> = ({ onDone }) => {
  const { notTop10Addresses, gnosisAccounts, watchAccounts, fetchAccounts } =
    useAccountInfo();
  const { bottom } = useSafeAreaInsets();
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [isScrolling, setIsScrolling] = React.useState(false);
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleScrollBeginDrag = React.useCallback(() => {
    if (IS_IOS) {
      return;
    }
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  }, []);

  const handleScrollEndDrag = React.useCallback(() => {
    if (IS_IOS) {
      return;
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 100);
  }, []);

  React.useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const sections = useMemo(() => {
    const result: Array<{
      title: string;
      data: KeyringAccountWithAlias[];
      type: 'notTop10Addresses' | 'gnosisAccounts' | 'watchAccounts';
    }> = [];

    if (notTop10Addresses.length > 0) {
      result.push({
        title: t('page.addressDetail.notMatterAddressDialog.notTop10Address'),
        data: notTop10Addresses,
        type: 'notTop10Addresses',
      });
    }

    if (gnosisAccounts.length > 0) {
      result.push({
        title: t('page.addressDetail.notMatterAddressDialog.safeWallet'),
        data: gnosisAccounts,
        type: 'gnosisAccounts',
      });
    }

    if (watchAccounts.length > 0) {
      result.push({
        title: t('page.addressDetail.notMatterAddressDialog.watchOnlyWallet'),
        data: watchAccounts,
        type: 'watchAccounts',
      });
    }

    return result;
  }, [notTop10Addresses, gnosisAccounts, watchAccounts, t]);

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
      {section.type === 'notTop10Addresses' && (
        <TouchableOpacity
          onPress={() => {
            const modalId = createGlobalBottomSheetModal2024({
              name: MODAL_NAMES.DESCRIPTION,
              title: t('page.addressDetail.notMatterAddressDialog.helpTitle'),
              bottomSheetModalProps: {
                enableContentPanningGesture: true,
                enablePanDownToClose: true,
                snapPoints: [300],
              },
              sections: [
                {
                  description: t(
                    'page.addressDetail.notMatterAddressDialog.helpDescription1',
                  ),
                },
                {
                  description: t(
                    'page.addressDetail.notMatterAddressDialog.helpDescription2',
                  ),
                },
              ],
            });
          }}>
          <HelpIcon width={20} height={20} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderItem = ({ item, index }) => (
    <View style={styles.itemGap}>
      <AddressItemEntry
        handleGoDetail={onDone}
        account={item}
        isScrolling={isScrolling}
        useLongPressing={true}
      />
    </View>
  );

  return (
    <AutoLockView as="View" style={styles.container}>
      <View style={styles.listHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.listTitle}>
            {t('page.addressDetail.notMatterAddressDialog.title')}
          </Text>
        </View>
      </View>
      <BottomSheetSectionList
        sections={sections}
        keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
        style={styles.listContainer}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<View style={{ height: bottom + 16 }} />}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.contentContainer}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollBegin={handleScrollBeginDrag}
        onMomentumScrollEnd={handleScrollEndDrag}
      />
    </AutoLockView>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    // paddingTop: 16,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  itemGap: {
    marginBottom: 12,
  },
  listHeader: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    maxWidth: 280,
    // gap: 12,
    // paddingHorizontal: 16,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    // textAlign: 'center',
  },
  horizontalLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors2024['neutral-line'],
  },
  sectionHeader: {
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 4,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  footer: {
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 16,
    borderRadius: 20,
  },
  footerMain: {
    height: 46,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerText: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
}));
