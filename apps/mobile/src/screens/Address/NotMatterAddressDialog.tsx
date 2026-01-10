import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { AddressItemEntry } from './components/AddressItem';
import { createGetStyles2024 } from '@/utils/styles';
import HelpIcon from '@/assets2024/icons/common/help.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccountInfo } from './components/MultiAssets/hooks';
import { useTranslation } from 'react-i18next';
import AutoLockView from '@/components/AutoLockView';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { TouchableOpacity } from 'react-native';
import { createGlobalBottomSheetModal2024 } from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { IS_IOS } from '@/core/native/utils';
import ArrowLeftSVG from '@/components/AccountSelectModalTx/icons/nav-left-cc.svg';
import { ManageSetting } from './components/ManageSetting';
import RcIconSettingCC from '@/assets2024/icons/common/IconSetting.svg';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

export const NotMatterAddressDialog: React.FC<{
  onDone?: () => void;
  onBack?: () => void;
  showBackArrow?: boolean;
}> = ({ onDone, onBack, showBackArrow = true }) => {
  const { myNotTop10Accounts, gnosisAccounts, watchAccounts, fetchAccounts } =
    useAccountInfo();
  const { bottom } = useSafeAreaInsets();
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [isScrolling, setIsScrolling] = React.useState(false);
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout>();
  const [isManageMode, setIsManageMode] = React.useState(false);

  const switchManageMode = () => {
    setIsManageMode(e => !e);
  };

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
      type: 'myNotTop10Accounts' | 'gnosisAccounts' | 'watchAccounts';
    }> = [];

    if (myNotTop10Accounts.length > 0) {
      result.push({
        title: t('page.addressDetail.notMatterAddressDialog.notTop10Address'),
        data: myNotTop10Accounts,
        type: 'myNotTop10Accounts',
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
  }, [myNotTop10Accounts, gnosisAccounts, watchAccounts, t]);

  const renderSectionHeader = useCallback(
    ({ section }) => (
      <View style={[styles.sectionHeader, isManageMode && { paddingLeft: 48 }]}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
        {section.type === 'notTop10Accounts' && (
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
    ),
    [isManageMode, styles.sectionHeader, styles.sectionHeaderText, t],
  );

  const renderItem = useCallback(
    ({ item }) => {
      if (isManageMode) {
        const gotoAddressDetail = () => {
          onDone?.();
          naviPush(RootNames.StackAddress, {
            screen: RootNames.AddressDetail,
            params: {
              address: item.address,
              type: item.type,
              brandName: item.brandName,
            },
          });
        };
        return (
          <View style={[styles.itemGap, styles.manageModeItem]}>
            <Pressable onPress={gotoAddressDetail} style={styles.manageBtn}>
              <RcIconSettingCC
                width={20}
                height={20}
                color={colors2024['neutral-secondary']}
              />
            </Pressable>
            <View style={{ width: '100%' }}>
              <AddressItemEntry
                showMarkIfNewlyAdded
                handleGoDetail={onDone}
                account={item}
                isScrolling={isScrolling}
                useLongPressing={true}
              />
            </View>
          </View>
        );
      }

      return (
        <View style={styles.itemGap}>
          <AddressItemEntry
            showMarkIfNewlyAdded
            handleGoDetail={onDone}
            account={item}
            isScrolling={isScrolling}
            useLongPressing={true}
          />
        </View>
      );
    },
    [colors2024, isManageMode, isScrolling, onDone, styles],
  );

  return (
    <AutoLockView as="View" style={styles.container}>
      <View style={styles.listHeader}>
        {showBackArrow ? (
          <Pressable onPress={onBack} style={styles.backButton}>
            <ArrowLeftSVG
              width={24}
              height={24}
              color={colors2024['neutral-title-1']}
            />
          </Pressable>
        ) : null}
        <View style={styles.titleContainer}>
          <Text style={styles.listTitle}>
            {t('page.addressDetail.notMatterAddressDialog.title')}
          </Text>
        </View>

        <View style={styles.manageButton}>
          <ManageSetting
            isManageMode={isManageMode}
            switchManageMode={switchManageMode}
          />
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

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  container: {
    flex: 1,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 0,
  },
  manageButton: {
    position: 'absolute',
    right: 20,
    top: 0,
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
  manageModeItem: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -16,
  },
  manageBtn: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listHeader: {
    position: 'relative',
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
