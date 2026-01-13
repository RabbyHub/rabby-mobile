import React from 'react';
import {
  View,
  Text,
  SectionListProps,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { AppBottomSheetModal } from '@/components';
import {
  BottomSheetModalProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import {
  ApprovalAssetsItem,
  useApprovalsPage,
  useFocusedApprovalOnApprovals,
  useRevokeAssetSpenders,
} from '../useApprovalsPage';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { MiniButton } from '@/components/Button';
import ApprovalCardAsset from './ApprovalCardAsset';
import { InModalApprovalAssetRow } from './InModalApprovalAssetRow';
import { usePsudoPagination } from '@/hooks/common/usePagination';
import { EmptyHolder } from '@/components/EmptyHolder';
import { BottomSheetModalFooterButton } from './Layout';
import { ApprovalsLayouts } from '../layout';
import AutoLockView from '@/components/AutoLockView';
import { useTranslation } from 'react-i18next';
import { useBatchRevoke } from '@/screens/BatchRevoke/useBatchRevoke';
import { querySelectedAssetSpender } from '../utils';
import { Account } from '@/core/services/preference';

const MemoInModalApprovalAssetRow = React.memo(
  InModalApprovalAssetRow,
  (prevProps, nextProps) => {
    return (
      prevProps.spender.$assetParent?.chain ===
        nextProps.spender.$assetContract?.chain &&
      prevProps.spender.id === nextProps.spender.id &&
      prevProps.isSelected === nextProps.isSelected
    );
  },
);

export default function BottomSheetApprovalAsset({
  modalProps,
  account,
}: {
  modalProps?: BottomSheetModalProps;
  account: Account;
}) {
  const { t } = useTranslation();
  const {
    sheetModalRefs: { approvalAssetDetail: modalRef },
    assetFocusingRevokeMap,
    focusedAssetApproval,
    toggleFocusedAssetItem,
  } = useFocusedApprovalOnApprovals();

  const {
    toggleSelectAssetSpender,
    nextShouldPickAllFocusingAsset,
    onSelectAllAsset,
  } = useRevokeAssetSpenders();

  const confirmingAssetsCount = React.useMemo(
    () => Object.keys(assetFocusingRevokeMap).length,
    [assetFocusingRevokeMap],
  );

  const { displaySortedAssetsList } = useApprovalsPage();
  const batchRevoke = useBatchRevoke({ account });

  const handleRevoke = React.useCallback(() => {
    const currentRevokeList = Object.values(assetFocusingRevokeMap);

    if (currentRevokeList.length > 1) {
      modalRef?.current?.close();
    }

    batchRevoke(currentRevokeList, displaySortedAssetsList).finally(() => {
      modalRef?.current?.close();
    });
  }, [batchRevoke, assetFocusingRevokeMap, displaySortedAssetsList, modalRef]);

  const { styles } = useTheme2024({ getStyle });

  const { fallList, simulateLoadNext, isFetchingNextPage } =
    usePsudoPagination<ApprovalAssetsItem>(focusedAssetApproval?.list || [], {
      pageSize: 20,
    });

  const sectionList = React.useMemo(() => {
    return !fallList?.length
      ? []
      : [
          {
            title: '',
            data: fallList,
          },
        ];
  }, [fallList]);

  const keyExtractor = React.useCallback<
    SectionListProps<ApprovalAssetsItem>['keyExtractor'] & object
  >((contractItem, index) => {
    return `${contractItem.id}-${index}`;
  }, []);

  const renderItem = React.useCallback<
    SectionListProps<ApprovalAssetsItem>['renderItem'] & object
  >(
    ({ item, index }) => {
      const isSelected = !!querySelectedAssetSpender(
        assetFocusingRevokeMap,
        item,
      );

      return (
        <View
          key={`${item.$assetParent?.chain}-${item.id}-${index}`}
          style={{
            marginTop: index === 0 ? 0 : 8,
          }}>
          <MemoInModalApprovalAssetRow
            approval={focusedAssetApproval!}
            spender={item}
            isSelected={isSelected}
            onToggleSelection={ctx => toggleSelectAssetSpender(ctx, 'focusing')}
          />
        </View>
      );
    },
    [assetFocusingRevokeMap, focusedAssetApproval, toggleSelectAssetSpender],
  );

  const onEndReached = React.useCallback(() => {
    simulateLoadNext(50);
  }, [simulateLoadNext]);

  const ListEmptyComponent = React.useMemo(() => {
    return <EmptyHolder text="No Approved" type="card" />;
  }, []);

  return (
    <AppBottomSheetModal
      {...modalProps}
      ref={modalRef}
      style={styles.sheetModalContainer}
      handleStyle={[styles.handle, styles.bg]}
      enablePanDownToClose={true}
      enableContentPanningGesture={true}
      backgroundStyle={styles.bg}
      keyboardBlurBehavior="restore"
      onDismiss={() => {
        toggleFocusedAssetItem({ assetItemToBlur: focusedAssetApproval });
      }}
      snapPoints={['75%']}
      bottomInset={1}>
      {focusedAssetApproval && (
        <AutoLockView as="View" style={[styles.bodyContainer]}>
          <BottomSheetScrollView>
            <View style={styles.staticArea}>
              <ApprovalCardAsset
                assetItem={focusedAssetApproval}
                inDetailModal
                style={styles.headerTitle}
              />

              <View style={styles.listHeadOps}>
                <Text style={styles.listHeadText}>
                  {t('page.approvals.approvedAssets')}
                </Text>
                <MiniButton
                  disabled={!focusedAssetApproval?.list.length}
                  style={styles.miniBtn}
                  onPress={() =>
                    onSelectAllAsset(
                      focusedAssetApproval!,
                      nextShouldPickAllFocusingAsset,
                      'focusing',
                    )
                  }>
                  {nextShouldPickAllFocusingAsset
                    ? 'Select All'
                    : 'Unselect All'}
                </MiniButton>
              </View>
            </View>

            <SectionList
              scrollEnabled={false}
              initialNumToRender={4}
              maxToRenderPerBatch={20}
              ListFooterComponent={
                sectionList.length >= 20 ? (
                  <View style={styles.listFooterContainer}>
                    {isFetchingNextPage ? <ActivityIndicator /> : null}
                  </View>
                ) : null
              }
              style={[styles.scrollableView, styles.scrollableArea]}
              contentContainerStyle={styles.listContainer}
              renderItem={renderItem}
              sections={sectionList}
              keyExtractor={keyExtractor}
              ListEmptyComponent={ListEmptyComponent}
              stickySectionHeadersEnabled={false}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.3}
            />
          </BottomSheetScrollView>
          <BottomSheetModalFooterButton
            title={[
              t('page.approvals.component.RevokeButton.btnText'),

              confirmingAssetsCount && ` (${confirmingAssetsCount})`,
            ]
              .filter(Boolean)
              .join('')}
            onPress={handleRevoke}
          />
        </AutoLockView>
      )}
    </AppBottomSheetModal>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    sheetModalContainer: {
      paddingVertical: 0,
      flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: 32,
    },
    handle: {
      height: 20,
    },
    bg: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
    },
    bodyContainer: {
      paddingVertical: 8,
      paddingBottom: ApprovalsLayouts.bottomSheetConfirmAreaHeight,
      height: '100%',
      // ...makeDebugBorder('red'),
    },
    staticArea: {
      paddingHorizontal: 16,
      flexShrink: 0,
    },
    headerTitle: {
      marginTop: 20,
    },
    listHeadOps: {
      marginTop: 14,
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    listHeadText: {
      color: colors2024['neutral-foot'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
    },
    miniBtn: {
      backgroundColor: 'transparent',
    },
    scrollableArea: {
      flexShrink: 1,
      height: '100%',
      marginTop: 2,
      paddingBottom: 16,
    },
    scrollableView: {
      paddingHorizontal: 16,
    },
    listContainer: {
      paddingTop: 0,
      paddingBottom: 0,
      overflow: 'hidden',
    },
    listFooterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors2024['neutral-bg-1'],
      height: ApprovalsLayouts.listFooterComponentHeight,
      // ...makeDebugBorder('green'),
    },
  };
});
