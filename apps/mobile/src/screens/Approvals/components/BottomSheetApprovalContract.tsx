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
  ContractApprovalItem,
  useFocusedApprovalOnApprovals,
  useRevokeContractSpenders,
} from '../useApprovalsPage';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import ApprovalCardContract from './ApprovalCardContract';
import { MiniButton } from '@/components/Button';
import { InModalApprovalContractRow } from './InModalApprovalContractRow';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { usePsudoPagination } from '@/hooks/common/usePagination';
import { ApprovalsLayouts } from './Layout';
import { TailedTitle } from '@/components/patches/Simulation';
import { parseContractApprovalListItem } from '../utils';
import { EmptyHolder } from '@/components/EmptyHolder';

export default function BottomSheetContractApproval({
  modalProps,
}: {
  modalProps?: BottomSheetModalProps;
}) {
  const {
    sheetModalRefs: { approvalContractDetail: modalRef },
    focusedContractApproval,
    toggleFocusedContractItem,
  } = useFocusedApprovalOnApprovals();

  const {
    toggleSelectContractSpender,
    nextShouldSelectAllContracts,
    onSelectAllContractApprovals,
  } = useRevokeContractSpenders();

  const { styles } = useThemeStyles(getStyles);

  const {
    fallList,
    simulateLoadNext,
    resetPage,
    isFetchingNextPage,
    isReachTheEnd,
  } = usePsudoPagination(focusedContractApproval?.list || [], { pageSize: 15 });

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
    SectionListProps<ContractApprovalItem['list'][number]>['keyExtractor'] &
      object
  >((contractItem, index) => {
    return `${parseContractApprovalListItem(contractItem).id}-${index}`;
  }, []);

  const renderItem = React.useCallback<
    SectionListProps<ContractApprovalItem['list'][number]>['renderItem'] &
      object
  >(
    ({ item, section: _, index }) => {
      const isFirstItem = index === 0;
      const { id, chain } = parseContractApprovalListItem(item);

      if (!focusedContractApproval) return null;

      return (
        <View
          key={`${chain}-${id}-${index}`}
          style={[
            styles.rowItem,
            isFirstItem ? { marginTop: 0 } : { marginTop: 12 },
          ]}>
          {__DEV__ && (
            <Text
              style={[styles.rowOrderText, { marginRight: 4, flexShrink: 0 }]}>
              {index + 1}.
            </Text>
          )}
          <InModalApprovalContractRow
            style={{ flexShrink: 1 }}
            approval={focusedContractApproval}
            contractApproval={item}
            onToggleSelection={toggleSelectContractSpender}
          />
        </View>
      );
    },
    [toggleSelectContractSpender, focusedContractApproval, styles],
  );

  const onEndReached = React.useCallback(() => {
    simulateLoadNext(150);
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
        toggleFocusedContractItem(null);
      }}
      snapPoints={['80%']}
      bottomInset={1}>
      {focusedContractApproval && (
        <BottomSheetView style={[styles.bodyContainer]}>
          <BottomSheetHandlableView style={styles.staticArea}>
            <ApprovalCardContract
              contract={focusedContractApproval}
              inDetailModal
            />

            <View style={styles.listHeadOps}>
              <Text style={styles.listHeadText}>
                Approved Contracts & Amount
              </Text>
              <MiniButton
                disabled={!focusedContractApproval?.list.length}
                onPress={() =>
                  onSelectAllContractApprovals(
                    focusedContractApproval!,
                    nextShouldSelectAllContracts,
                  )
                }>
                {nextShouldSelectAllContracts ? 'Select All' : 'Unselect All'}
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
    rowItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rowOrderText: {
      color: colors['neutral-title1'],
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
