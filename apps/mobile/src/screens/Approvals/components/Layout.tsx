import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  View,
  Text,
  Dimensions,
  StatusBar,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useTheme2024, useThemeColors, useThemeStyles } from '@/hooks/theme';
import { Button } from '@/components2024/Button';
import { useTranslation, Trans } from 'react-i18next';

import { createGetStyles, createGetStyles2024 } from '@/utils/styles';

import { RcIconPartChecked } from '../icons';
import { RcIconNoCheck, RcIconHasCheckbox } from '@/assets/icons/common';

import { useApprovalsPage, useRevokeApprovals } from '../useApprovalsPage';
import { apiApprovals } from '@/core/apis';
import { useRefState } from '@/hooks/common/useRefState';
import { ApprovalsLayouts } from '../layout';
import { summarizeRevoke } from '@rabby-wallet/biz-utils/dist/isomorphic/approval';
import RcIconNoFind from '@/assets2024/icons/address/noFind.svg';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { useApprovalAlertCounts } from '@/screens/Home/hooks/approvals';
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
  const { safeOffBottom } = useSafeSizes();

  return (
    <ViewComponent
      {...props}
      style={[
        props?.style,
        {
          paddingTop: ApprovalsLayouts.tabbarHeight,
          paddingBottom:
            safeSizes.bottomAreaHeight + (isAndroid ? safeOffBottom : 0),
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

  const { styles } = useTheme2024({ getStyle });

  const [showModal, setShowModal] = useState(false);

  const { forceUpdate } = useApprovalAlertCounts();
  const {
    filterType,
    loadApprovals,
    safeSizeInfo: { safeSizes },
  } = useApprovalsPage();
  const { contractRevokeMap, assetRevokeMap, resetRevokeMaps } =
    useRevokeApprovals();

  const timeoutId = React.useRef<ReturnType<typeof setTimeout>>();

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
  const { safeOffBottom } = useSafeSizes();

  useEffect(() => {
    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, []);

  const handleRevoke = React.useCallback(() => {
    setShowModal(false);
    if (isSubmitLoadingRef.current) {
      return;
    }
    setIsSubmitLoading(true, true);

    apiApprovals
      .revoke({ list: currentRevokeList })
      .then(() => {
        if (timeoutId.current) {
          clearTimeout(timeoutId.current);
          timeoutId.current = undefined;
        }
        forceUpdate();
        timeoutId.current = setTimeout(() => {
          loadApprovals();
        }, 1000);
        resetRevokeMaps();
      })
      .catch(err => {
        console.error(err);
      })
      .finally(() => {
        setIsSubmitLoading(false, true);
      });
  }, [
    isSubmitLoadingRef,
    setIsSubmitLoading,
    currentRevokeList,
    forceUpdate,
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
      style={[
        styles.bottomDockArea,
        isAndroid && { paddingBottom: safeOffBottom },
      ]}>
      <Button
        disabled={!couldSubmit}
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
            <FooterButtonGroup
              style={styles.btns}
              onCancel={() => setShowModal(false)}
              onConfirm={handleRevoke}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  bottomDockArea: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    width: '100%',
    marginBottom: 56,
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
    color: colors2024['neutral-title-2'],
  },

  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    marginBottom: 20,
  },
  highlightText: {
    color: colors2024['brand-default'],
  },
  modalBody: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    lineHeight: 20,
  },
  btns: {
    padding: 0,
    marginTop: 20,
  },
}));

export const getTooltipContentStyles = createGetStyles(colors => {
  return {
    tipContent: {
      // maxWidth: 358,
      padding: 12,
      alignItems: 'center',
      flexDirection: 'row',
      fontFamily: 'SF Pro Rounded',
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
      <RcIconHasCheckbox
        width={size}
        height={size}
        style={[contractCheckboxStyle, style]}
        color={colors['blue-default']}
      />
    );
  }

  if (isSelectedPartial) {
    return (
      <RcIconPartChecked
        width={size}
        height={size}
        style={[contractCheckboxStyle, style]}
        color={colors['blue-default']}
      />
    );
  }

  return (
    <RcIconNoCheck
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
  const { searchKw, setSearchKw } = useApprovalsPage();
  const { styles } = useTheme2024({ getStyle: getNotMatchedHolderStyle });
  return (
    <View style={[styles.container, style]}>
      <RcIconNoFind width={159} height={117} />
      <Text style={styles.emptyText}>{text}</Text>
      {!!searchKw && (
        <TouchableOpacity onPress={() => setSearchKw('')}>
          <Text style={styles.cleanText}>Review All approvals</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const getNotMatchedHolderStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      marginTop: 21,
      fontSize: 16,
      lineHeight: 20,
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-info'],
      fontWeight: '400',
    },
    cleanText: {
      marginTop: 12,
      fontWeight: '700',
      fontSize: 16,
      color: colors2024['brand-default'],
      fontFamily: 'SF Pro Rounded',
    },
  };
});

export const getSelectableContainerStyle = createGetStyles2024(
  ({ colors, colors2024 }) => {
    return {
      container: {
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: colors2024['neutral-line'],
      },
      selectedContainer: {
        backgroundColor: colors2024['brand-light-1'],
      },
    };
  },
);

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
