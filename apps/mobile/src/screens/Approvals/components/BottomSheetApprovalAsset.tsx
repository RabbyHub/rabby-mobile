import React from 'react';
import { View, Text, SectionListProps, ActivityIndicator } from 'react-native';

import { AppBottomSheetModal } from '@/components';
import {
  BottomSheetModalProps,
  BottomSheetScrollView,
  BottomSheetSectionList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
  ApprovalAssetsItem,
  useFocusedApprovalOnApprovals,
} from '../useApprovalsPage';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { MiniButton } from '@/components/Button';
import ApprovalCardAsset from './ApprovalCardAsset';
import { InModalApprovalAssetRow } from './InModalApprovalAssetRow';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { usePsudoPagination } from '@/hooks/common/usePagination';
import { EmptyHolder } from '@/components/EmptyHolder';
import { TailedTitle } from '@/components/patches/Simulation';
import { ApprovalsLayouts } from './Layout';

export default function BottomSheetAssetApproval({
  modalProps,
}: {
  modalProps?: BottomSheetModalProps;
}) {
  const {
    sheetModalRefs: { approvalAssetDetail: modalRef },
    focusedApprovalAsset,
    toggleFocusedContractItem,
  } = useFocusedApprovalOnApprovals();

  const { styles } = useThemeStyles(getStyles);

  const {
    fallList,
    simulateLoadNext,
    resetPage,
    isFetchingNextPage,
    isReachTheEnd,
  } = usePsudoPagination<ApprovalAssetsItem>(focusedApprovalAsset?.list || [], {
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
  >(({ item, section, index }) => {
    const isFirstItem = index === 0;
    return (
      <View
        key={`${item.$assetParent?.chain}-${item.id}-${index}`}
        style={[isFirstItem ? { marginTop: 0 } : { marginTop: 12 }]}>
        <InModalApprovalAssetRow spender={item} />
      </View>
    );
  }, []);

  const onEndReached = React.useCallback(() => {
    simulateLoadNext(50);
  }, [simulateLoadNext]);

  const ListEmptyComponent = React.useMemo(() => {
    return <EmptyHolder text="No Assets" type="card" />;
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
        toggleFocusedContractItem(null);
      }}
      snapPoints={['80%']}
      bottomInset={1}>
      {focusedApprovalAsset && (
        <BottomSheetView style={[styles.bodyContainer]}>
          <BottomSheetHandlableView style={styles.staticArea}>
            <ApprovalCardAsset assetItem={focusedApprovalAsset} inDetailModal />

            <View style={styles.listHeadOps}>
              <Text style={styles.listHeadText}>
                {/* Approved Assets Amount & Balance */}
                Approved to the following Contracts
              </Text>
              <MiniButton
                disabled={!focusedApprovalAsset?.list.length}
                onPress={() => {}}>
                Select All
              </MiniButton>
            </View>
          </BottomSheetHandlableView>

          <BottomSheetSectionList
            initialNumToRender={4}
            maxToRenderPerBatch={20}
            ListFooterComponent={
              <View style={styles.listFooterContainer}>
                {isFetchingNextPage ? (
                  <ActivityIndicator />
                ) : sectionList.length && isReachTheEnd ? (
                  <TailedTitle
                    style={{
                      paddingHorizontal:
                        ApprovalsLayouts.innerContainerHorizontalOffset,
                    }}
                    text="No more"
                  />
                ) : null}
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
      paddingBottom: 0,
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
      marginTop: 16,
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
