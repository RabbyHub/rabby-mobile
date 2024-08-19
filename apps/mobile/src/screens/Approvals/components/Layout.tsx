import React, { useMemo, useState } from 'react';
import {
  Platform,
  View,
  Text,
  Dimensions,
  StatusBar,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { Button } from '@/components';

import { useTranslation, Trans } from 'react-i18next';
import { createGetStyles } from '@/utils/styles';

import {
  RcIconCheckedCC,
  RcIconIndeterminateCC,
  RcIconNotMatchedCC,
  RcIconUncheckCC,
} from '../icons';
import { useApprovalsPage, useRevokeApprovals } from '../useApprovalsPage';
import { apiApprovals } from '@/core/apis';
import { useRefState } from '@/hooks/common/useRefState';
import { ApprovalsLayouts } from '../layout';
import { summarizeRevoke } from '@rabby-wallet/biz-utils/dist/isomorphic/approval';
/** @deprecated import from '../layout' directly */
export { ApprovalsLayouts };

const isAndroid = Platform.OS === 'android';

export function getScrollableSectionHeight(options?: {
  bottomAreaHeight?: number;
}) {
  const A = ApprovalsLayouts;
  const { bottomAreaHeight = A.bottomAreaHeight } = options || {};

  return (
    Dimensions.get('window').height -
    (StatusBar.currentHeight || 0) -
    A.tabbarHeight -
    bottomAreaHeight -
    A.searchBarHeight -
    A.searchBarMarginOffset * 2 -
    (isAndroid ? 0 : A.contentInsetTopOffset + A.tabbarHeight)
  );
}

export function ApprovalsTabView<T extends React.ComponentType<any>>({
  children,
  ViewComponent = View,
  innerStyle,
  ...props
}: React.PropsWithChildren<
  RNViewProps & {
    ViewComponent?: T;
    innerStyle?: RNViewProps['style'];
  } & React.ComponentProps<T>
>) {
  const {
    safeSizeInfo: { safeSizes },
  } = useApprovalsPage();

  return (
    <ViewComponent
      {...props}
      style={[
        props?.style,
        {
          paddingTop: ApprovalsLayouts.tabbarHeight,
          paddingBottom: safeSizes.bottomAreaHeight,
        },
      ]}>
      <View style={[{ height: '100%', width: '100%' }, innerStyle]}>
        {children}
      </View>
    </ViewComponent>
  );
}

export function ApprovalsBottomArea() {
  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = getStyles(colors);

  const [showModal, setShowModal] = useState(false);

  const {
    filterType,
    loadApprovals,
    safeSizeInfo: { safeSizes },
  } = useApprovalsPage();
  const { contractRevokeMap, assetRevokeMap, resetRevokeMaps } =
    useRevokeApprovals();

  const { currentRevokeList, revokeSummary } = React.useMemo(() => {
    const list =
      filterType === 'contract'
        ? Object.values(contractRevokeMap)
        : filterType === 'assets'
        ? Object.values(assetRevokeMap)
        : [];
    return {
      currentRevokeList: list,
      revokeSummary: summarizeRevoke(list),
    };
  }, [filterType, contractRevokeMap, assetRevokeMap]);

  const { couldSubmit, buttonTitle } = useMemo(() => {
    const revokeCount = revokeSummary.statics.txCount;
    const buttonTitle = [
      `${t('page.approvals.component.RevokeButton.btnText', {
        // count: revokeList.length,
        // count: revokeCount,
      })}`,
      revokeCount && ` (${currentRevokeList.length})`,
    ]
      .filter(Boolean)
      .join('');

    return {
      couldSubmit: !!revokeCount,
      buttonTitle,
    };
  }, [revokeSummary.statics.txCount, t, currentRevokeList.length]);

  const {
    state: isSubmitLoading,
    setRefState: setIsSubmitLoading,
    stateRef: isSubmitLoadingRef,
  } = useRefState(false);

  const handleRevoke = React.useCallback(() => {
    setShowModal(false);
    if (isSubmitLoadingRef.current) return;
    setIsSubmitLoading(true, true);

    apiApprovals
      .revoke({ list: currentRevokeList })
      .then(() => {
        loadApprovals();
        resetRevokeMaps();
      })
      .catch(err => {
        console.error(err);
      })
      .finally(() => {
        setIsSubmitLoading(false, true);
      });
  }, [
    currentRevokeList,
    isSubmitLoadingRef,
    setIsSubmitLoading,
    resetRevokeMaps,
    loadApprovals,
  ]);

  const onRevoke = () => {
    const hasPackedPermit2Sign = Object.values(
      revokeSummary.permit2Revokes,
    ).some(x => x.tokenSpenders.length > 1);

    if (!hasPackedPermit2Sign) {
      return handleRevoke();
    }
    setShowModal(true);
  };

  return (
    <View
      style={[styles.bottomDockArea, { height: safeSizes.bottomAreaHeight }]}>
      <Button
        disabled={!couldSubmit}
        containerStyle={styles.buttonContainer}
        titleStyle={styles.buttonText}
        disabledTitleStyle={styles.buttonText}
        type="primary"
        title={buttonTitle}
        loading={isSubmitLoading}
        onPress={onRevoke}
      />
      <Modal
        visible={showModal}
        transparent={true}
        onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity
          style={styles.modalContainer}
          onPress={() => setShowModal(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContent}
            onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              <Trans
                i18nKey="page.approvals.component.RevokeButton.permit2Batch.modalTitle"
                values={{ count: revokeSummary.statics.txCount }}>
                A total of{' '}
                <Text style={styles.highlightText}>
                  {revokeSummary.statics.txCount}
                </Text>{' '}
                signature is required
              </Trans>
            </Text>
            <Text style={styles.modalBody}>
              {t(
                'page.approvals.component.RevokeButton.permit2Batch.modalContent',
              )}
            </Text>
            <TouchableOpacity style={styles.okButton} onPress={handleRevoke}>
              <Text style={styles.okButtonText}>{t('global.confirm')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    bottomDockArea: {
      bottom: 0,
      width: '100%',
      padding: 20,
      height: ApprovalsLayouts.bottomAreaHeight,
      backgroundColor: colors['neutral-bg1'],
      // ...makeDevOnlyStyle({ backgroundColor: 'transparent' }),
      borderTopWidth: 0.5,
      borderTopStyle: 'solid',
      borderTopColor: colors['neutral-line'],
      position: 'absolute',
    },

    buttonContainer: {
      width: '100%',
      height: 52,
      borderRadius: 6,
      ...(!isAndroid && {
        marginBottom: 16,
      }),
    },

    buttonText: {
      color: colors['neutral-title-2'],
    },

    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      width: '80%',
      backgroundColor: colors['neutral-bg1'],
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '500',
      lineHeight: 24,
      color: colors['neutral-title1'],
      textAlign: 'center',
      marginBottom: 16,
    },
    highlightText: {
      color: colors['blue-default'],
    },
    modalBody: {
      fontSize: 14,
      color: colors['neutral-body'],
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 60,
    },
    okButton: {
      width: '100%',
      height: 48,
      backgroundColor: colors['blue-default'],
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
    },
    okButtonText: {
      color: colors['neutral-title2'],
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '600',
    },
  };
});

export const getTooltipContentStyles = createGetStyles(colors => {
  return {
    tipContent: {
      // maxWidth: 358,
      padding: 12,
      alignItems: 'center',
      flexDirection: 'row',
    },
    tipContentIcon: {
      width: 12,
      height: 12,
      marginRight: 4,
    },
  };
});

export function SelectionCheckbox({
  isSelectedAll,
  isSelectedPartial,
  style,
  size = 20,
}: {
  isSelectedAll: boolean;
  isSelectedPartial: boolean;
  size?: number;
} & RNViewProps) {
  const colors = useThemeColors();

  if (isSelectedAll) {
    return (
      <RcIconCheckedCC
        style={[contractCheckboxStyle, style]}
        color={colors['blue-default']}
      />
    );
  }

  if (isSelectedPartial) {
    return (
      <RcIconIndeterminateCC
        width={size}
        height={size}
        style={[contractCheckboxStyle, style]}
        color={colors['blue-default']}
      />
    );
  }

  return (
    <RcIconUncheckCC
      width={size}
      height={size}
      style={[contractCheckboxStyle, style]}
      color={colors['neutral-line']}
    />
  );
}

const contractCheckboxStyle = {
  width: 20,
  height: 20,
};

export function NotMatchedHolder({
  style,
  text = 'Not Matched',
}: RNViewProps & { text?: string }) {
  const { colors, styles } = useThemeStyles(getNotMatchedHolderStyle);
  return (
    <View style={[styles.container, style]}>
      <RcIconNotMatchedCC
        width={32}
        height={32}
        color={colors['neutral-body']}
      />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}
const getNotMatchedHolderStyle = createGetStyles(colors => {
  return {
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      marginTop: 12,
      fontSize: 15,
      color: colors['neutral-body'],
      fontWeight: '600',
    },
  };
});

export const getSelectableContainerStyle = createGetStyles(colors => {
  return {
    container: {
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors['neutral-card1'],
    },
    selectedContainer: {
      borderColor: colors['blue-default'],
      backgroundColor: colors['blue-light1'],
    },
  };
});

export function BottomSheetModalFooterButton({
  ...buttonProps
}: React.PropsWithoutRef<React.ComponentProps<typeof Button>>) {
  const { styles } = useThemeStyles(getBottomSheetModalFooterButtonStyles);
  const {
    safeSizeInfo: { safeSizes, androidBottomOffset },
  } = useApprovalsPage();

  return (
    <View
      style={[
        styles.footerContainer,
        {
          height: safeSizes.bottomSheetConfirmAreaHeight,
          paddingBottom: androidBottomOffset,
        },
      ]}>
      <Button
        {...buttonProps}
        titleStyle={[styles.footerText, buttonProps?.titleStyle]}
        disabledTitleStyle={[
          styles.disabledFooterText,
          buttonProps?.disabledTitleStyle,
        ]}
        containerStyle={[
          styles.footerButtonContainer,
          buttonProps?.containerStyle,
        ]}
      />
    </View>
  );
}

const getBottomSheetModalFooterButtonStyles = createGetStyles(colors => {
  return {
    footerContainer: {
      borderTopWidth: 0.5,
      borderTopStyle: 'solid',
      borderTopColor: colors['neutral-line'],
      backgroundColor: colors['neutral-bg1'],
      paddingVertical: 20,
      paddingHorizontal: 20,
      height: ApprovalsLayouts.bottomSheetConfirmAreaHeight,
      flexShrink: 0,

      position: 'absolute',
      bottom: 0,
      left: 0,
      width: '100%',
      alignItems: 'center',
    },
    footerButtonContainer: {
      minWidth: 248,
      height: 52,
      width: '100%',
    },
    footerText: {
      color: colors['neutral-title2'],
    },
    disabledFooterText: {
      color: colors['neutral-title2'],
    },
  };
});
