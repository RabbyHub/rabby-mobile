import React from 'react';
import { View, Text, SectionListProps, ActivityIndicator } from 'react-native';

import { AppBottomSheetModal } from '@/components';
import {
  BottomSheetModalProps,
  BottomSheetSectionList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
  ApprovalAssetsItem,
  useFocusedApprovalOnApprovals,
  useRevokeAssetSpenders,
} from '../useApprovalsPage';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { MiniButton } from '@/components/Button';
import ApprovalCardAsset from './ApprovalCardAsset';
import { InModalApprovalAssetRow } from './InModalApprovalAssetRow';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { usePsudoPagination } from '@/hooks/common/usePagination';
import { EmptyHolder } from '@/components/EmptyHolder';
import { BottomSheetModalFooterButton } from './Layout';
import { ApprovalsLayouts } from '../layout';
import { ModalLayouts } from '@/constant/layout';

export default function BottomSheetAssetApproval({
  modalProps,
}: {
  modalProps?: BottomSheetModalProps;
}) {
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

  const { styles } = useThemeStyles(getStyles);

  const { fallList, simulateLoadNext, isFetchingNextPage, isReachTheEnd } =
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
    ({ item, section: _, index }) => {
      const isFirstItem = index === 0;

      return (
        <View
          key={`${item.$assetParent?.chain}-${item.id}-${index}`}
          style={[isFirstItem ? { marginTop: 0 } : { marginTop: 12 }]}>
          <InModalApprovalAssetRow
            approval={focusedAssetApproval!}
            spender={item}
            onToggleSelection={ctx => toggleSelectAssetSpender(ctx, 'focusing')}
          />
        </View>
      );
    },
    [toggleSelectAssetSpender, focusedAssetApproval],
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
      enableContentPanningGesture={false}
      backgroundStyle={styles.bg}
      keyboardBlurBehavior="restore"
      onDismiss={() => {
        toggleFocusedAssetItem({ assetItemToBlur: focusedAssetApproval });
      }}
      footerComponent={() => {
        return (
          <BottomSheetModalFooterButton
            title={[
              `Confirm`,
              confirmingAssetsCount && ` (${confirmingAssetsCount})`,
            ]
              .filter(Boolean)
              .join('')}
            onPress={() => {
              toggleFocusedAssetItem({
                assetItemToBlur: focusedAssetApproval,
                isConfirmSelected: true,
              });
            }}
          />
        );
      }}
      snapPoints={[ModalLayouts.defaultHeightPercentText]}
      bottomInset={1}>
      {focusedAssetApproval && (
        <BottomSheetView style={[styles.bodyContainer]}>
          <BottomSheetHandlableView style={styles.staticArea}>
            <ApprovalCardAsset assetItem={focusedAssetApproval} inDetailModal />

            <View style={styles.listHeadOps}>
              <Text style={styles.listHeadText}>
                Approved Contracts and Amount
              </Text>
              <MiniButton
                disabled={!focusedAssetApproval?.list.length}
                onPress={() =>
                  onSelectAllAsset(
                    focusedAssetApproval!,
                    nextShouldPickAllFocusingAsset,
                    'focusing',
                  )
                }>
                {nextShouldPickAllFocusingAsset ? 'Select All' : 'Unselect All'}
              </MiniButton>
            </View>
          </BottomSheetHandlableView>

          <BottomSheetSectionList
            initialNumToRender={4}
            maxToRenderPerBatch={20}
            ListFooterComponent={
              <View style={styles.listFooterContainer}>
                {isFetchingNextPage ? <ActivityIndicator /> : null}
              </View>
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
        </BottomSheetView>
      )}
    </AppBottomSheetModal>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    sheetModalContainer: {
      paddingVertical: 0,
      flexDirection: 'column',
    },
    handle: {
      height: 20,
    },
    bg: {
      backgroundColor: colors['neutral-bg2'],
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
    listHeadOps: {
      marginTop: 16,
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    listHeadText: {
      color: colors['neutral-body'],
      fontSize: 13,
      fontWeight: '400',
    },
    scrollableArea: {
      flexShrink: 1,
      height: '100%',
      marginTop: 12,
      paddingBottom: 16,
    },
    scrollableView: {
      paddingHorizontal: 16,
    },
    listContainer: {
      paddingTop: 0,
      paddingBottom: 0,
    },
    listFooterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: ApprovalsLayouts.listFooterComponentHeight,
      // ...makeDebugBorder('green'),
    },

    title: {
      fontSize: 20,
      lineHeight: 23,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      marginBottom: 16,
      paddingTop: 24,
      textAlign: 'center',
    },
  };
});
