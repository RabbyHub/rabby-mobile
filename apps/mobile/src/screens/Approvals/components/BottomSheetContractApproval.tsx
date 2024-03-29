import { View, Text } from 'react-native';

import { AppBottomSheetModal } from '@/components';
import {
  BottomSheetModalProps,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useFocusedApprovalOnApprovals } from '../useApprovalsPage';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import ApprovalContractCard from './ApprovalContractCard';
import { MiniButton } from '@/components/Button';
import { InModalApprovalContractRow } from './InModalRows';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

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
            <ApprovalContractCard
              contract={focusedApprovalContract}
              inDetailModal
            />

            <View style={styles.listHeadOps}>
              <Text style={styles.listHeadText}>
                Approved Assets Amount & Balance
              </Text>
              <MiniButton
                disabled={!focusedApprovalContract?.list.length}
                onPress={() => {}}>
                Select All
              </MiniButton>
            </View>
          </BottomSheetHandlableView>

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
