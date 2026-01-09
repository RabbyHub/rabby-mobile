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
  ContractApprovalItem,
  useApprovalsPage,
  useFocusedApprovalOnApprovals,
  useRevokeContractSpenders,
} from '../useApprovalsPage';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import ApprovalCardContract from './ApprovalCardContract';
import { MiniButton } from '@/components/Button';
import { InModalApprovalContractRow } from './InModalApprovalContractRow';
import { usePsudoPagination } from '@/hooks/common/usePagination';
import { BottomSheetModalFooterButton } from './Layout';
import { ApprovalsLayouts } from '../layout';
import {
  parseContractApprovalListItem,
  querySelectedContractSpender,
} from '../utils';
import { EmptyHolder } from '@/components/EmptyHolder';
import AutoLockView from '@/components/AutoLockView';
import { useTranslation } from 'react-i18next';
import { useBatchRevoke } from '@/screens/BatchRevoke/useBatchRevoke';
import { Account } from '@/core/services/preference';

const MemoInModalApprovalContractRow = React.memo(
  InModalApprovalContractRow,
  (prevProps, nextProps) => {
    return (
      prevProps.isSelected === nextProps.isSelected &&
      parseContractApprovalListItem(prevProps.contractApproval).id ===
        parseContractApprovalListItem(nextProps.contractApproval).id
    );
  },
);

export default function BottomSheetApprovalContract({
  modalProps,
  account,
}: {
  modalProps?: BottomSheetModalProps;
  account: Account;
}) {
  const {
    sheetModalRefs: { approvalContractDetail: modalRef },
    contractFocusingRevokeMap,
    focusedContractApproval,
    toggleFocusedContractItem,
  } = useFocusedApprovalOnApprovals();
  const { t } = useTranslation();

  const {
    toggleSelectContractSpender,
    nextShouldPickAllFocusingContracts,
    onSelectAllContractApprovals,
  } = useRevokeContractSpenders();

  const confirmingContractCount = React.useMemo(
    () => Object.keys(contractFocusingRevokeMap).length,
    [contractFocusingRevokeMap],
  );

  const { displaySortedAssetsList } = useApprovalsPage();
  const batchRevoke = useBatchRevoke({ account });

  const handleRevoke = React.useCallback(() => {
    const currentRevokeList = Object.values(contractFocusingRevokeMap);

    if (currentRevokeList.length > 1) {
      modalRef?.current?.close();
    }

    batchRevoke(currentRevokeList, displaySortedAssetsList).finally(() => {
      modalRef?.current?.close();
    });
  }, [
    batchRevoke,
    contractFocusingRevokeMap,
    displaySortedAssetsList,
    modalRef,
  ]);

  const { styles } = useTheme2024({ getStyle });

  const { fallList, simulateLoadNext, isFetchingNextPage } = usePsudoPagination(
    focusedContractApproval?.list || [],
    { pageSize: 15 },
  );

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
      const { id, chain } = parseContractApprovalListItem(item);

      if (!focusedContractApproval) {
        return null;
      }

      const isSelected = !!querySelectedContractSpender(
        contractFocusingRevokeMap,
        focusedContractApproval,
        item,
      );

      return (
        <View
          key={`${chain}-${id}-${index}`}
          style={[
            styles.rowItem,
            {
              marginTop: index === 0 ? 0 : 8,
            },
          ]}>
          {/* {__DEV__ && (
            <Text
              style={[styles.rowOrderText, { marginRight: 4, flexShrink: 0 }]}>
              {index + 1}.
            </Text>
          )} */}
          <MemoInModalApprovalContractRow
            style={{ flexShrink: 1 }}
            approval={focusedContractApproval}
            contractApproval={item}
            isSelected={isSelected}
            onToggleSelection={ctx =>
              toggleSelectContractSpender(ctx, 'focusing')
            }
          />
        </View>
      );
    },
    [
      focusedContractApproval,
      contractFocusingRevokeMap,
      styles.rowItem,
      toggleSelectContractSpender,
    ],
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
        toggleFocusedContractItem({
          contractItemToBlur: focusedContractApproval,
        });
      }}
      snapPoints={['75%']}
      bottomInset={1}>
      {focusedContractApproval && (
        <AutoLockView as="View" style={[styles.bodyContainer]}>
          <BottomSheetScrollView>
            <View style={styles.staticArea}>
              <ApprovalCardContract
                style={styles.headerTitle}
                contract={focusedContractApproval}
              />

              <View style={styles.listHeadOps}>
                <Text style={styles.listHeadText}>
                  {t('page.approvals.approvedContracts')}
                </Text>
                <MiniButton
                  disabled={!focusedContractApproval?.list.length}
                  style={styles.miniBtn}
                  onPress={() =>
                    onSelectAllContractApprovals(
                      focusedContractApproval!,
                      nextShouldPickAllFocusingContracts,
                      'focusing',
                    )
                  }>
                  {nextShouldPickAllFocusingContracts
                    ? t('page.approvals.selectAll')
                    : t('page.approvals.unselectAll')}
                </MiniButton>
              </View>
            </View>

            <SectionList
              scrollEnabled={false}
              initialNumToRender={4}
              maxToRenderPerBatch={20}
              ListFooterComponent={
                sectionList.length >= 15 ? (
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
              confirmingContractCount && ` (${confirmingContractCount})`,
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

const getStyle = createGetStyles2024(({ colors, colors2024, isLight }) => {
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
