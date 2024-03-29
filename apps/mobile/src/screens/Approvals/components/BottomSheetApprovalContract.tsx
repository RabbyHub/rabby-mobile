import React from 'react';
import { View, Text, SectionListProps } from 'react-native';

import { AppBottomSheetModal } from '@/components';
import {
  BottomSheetModalProps,
  BottomSheetScrollView,
  BottomSheetSectionList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useFocusedApprovalOnApprovals } from '../useApprovalsPage';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import ApprovalCardContract from './ApprovalCardContract';
import { MiniButton } from '@/components/Button';
import { InModalApprovalContractRow } from './InModalApprovalContractRow';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { usePsudoPagination } from '@/hooks/common/usePagination';

export default function BottomSheetContractApproval({
  modalProps,
}: {
  modalProps?: BottomSheetModalProps;
}) {
  const {
    sheetModalRefs: { approvalContractDetail: modalRef },
    focusedApprovalContract,
    toggleFocusedContractItem,
  } = useFocusedApprovalOnApprovals();

  const { styles } = useThemeStyles(getStyles);

  const {
    fallList,
    simulateLoadNext,
    resetPage,
    isFetchingNextPage,
    isReachTheEnd,
  } = usePsudoPagination(focusedApprovalContract?.list || [], { pageSize: 20 });

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

  // const keyExtractor = React.useCallback<
  //   SectionListProps<AssetApprovalItem>['keyExtractor'] & object
  // >((contractItem, index) => {
  //   return `${contractItem.id}-${index}`;
  // }, []);

  // const renderItem = React.useCallback<
  //   SectionListProps<AssetApprovalItem>['renderItem'] & object
  // >(
  //   ({ item, section, index }) => {
  //     const isFirstItem = index === 0;
  //     return (
  //       <View
  //         style={[
  //           styles.itemWrapper,
  //           isFirstItem ? { marginTop: 0 } : { marginTop: 12 },
  //         ]}>
  //         <ApprovalAssetRow assetsApprovalItem={item} listIndex={index} />
  //       </View>
  //     );
  //   },
  //   [styles],
  // );

  const onEndReached = React.useCallback(() => {
    simulateLoadNext(150);
  }, [simulateLoadNext]);

  // const ListEmptyComponent = React.useMemo(() => {
  //   return isLoading ? (
  //     <SkeletonListByAssets />
  //   ) : (
  //     <EmptyHolder text="No Assets" type="card" />
  //   );
  // }, [isLoading]);

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
      {focusedApprovalContract && (
        <BottomSheetView style={[styles.bodyContainer]}>
          <BottomSheetHandlableView style={styles.staticArea}>
            <ApprovalCardContract
              contract={focusedApprovalContract}
              inDetailModal
            />

            <View style={styles.listHeadOps}>
              <Text style={styles.listHeadText}>
                Approved Contracts & Amount
              </Text>
              <MiniButton
                disabled={!focusedApprovalContract?.list.length}
                onPress={() => {}}>
                Select All
              </MiniButton>
            </View>
          </BottomSheetHandlableView>
          {/*
          <BottomSheetSectionList
            style={[styles.scrollableView, styles.scrollableArea]}
            sections={sectionList}
            keyExtractor={keyExtractor}
            ListEmptyComponent={ListEmptyComponent}
            stickySectionHeadersEnabled={false}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
          >

          </BottomSheetSectionList> */}
          <BottomSheetScrollView
            style={[styles.scrollableView, styles.scrollableArea]}>
            {focusedApprovalContract.list.map((approval, idx, arr) => {
              return (
                <View key={`${approval.chain}-${idx}`}>
                  <InModalApprovalContractRow
                    contractApproval={approval}
                    style={[
                      idx > 0 && { marginTop: 8 },
                      idx === arr.length - 1 && { marginBottom: 16 },
                    ]}
                  />
                </View>
              );
            })}
          </BottomSheetScrollView>
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
