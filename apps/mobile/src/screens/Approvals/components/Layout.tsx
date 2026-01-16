import React, { useMemo } from 'react';
import {
  Platform,
  View,
  Text,
  Dimensions,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useTheme2024, useThemeColors, useThemeStyles } from '@/hooks/theme';
import { Button } from '@/components2024/Button';
import { useTranslation } from 'react-i18next';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { RcIconPartChecked } from '../icons';
import { RcIconNoCheck, RcIconHasCheckbox } from '@/assets/icons/common';
import {
  FILTER_TYPES,
  useApprovalsPage,
  useRevokeApprovals,
} from '../useApprovalsPage';
import { ApprovalsLayouts } from '../layout';
import { summarizeRevoke } from '@rabby-wallet/biz-utils/dist/isomorphic/approval';
import RcIconEmptyToken from '@/assets2024/singleHome/empty-token.svg';
import RcIconEmptyTokenDark from '@/assets2024/singleHome/empty-token-dark.svg';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useBatchRevoke } from '@/screens/BatchRevoke/useBatchRevoke';
import { Account } from '@/core/services/preference';
import { useEIP7702Approvals } from '../useEIP7702Approvals';

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

export function ApprovalsBottomArea({ account }: { account: Account }) {
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle });

  const { filterType } = useApprovalsPage();
  const { contractRevokeMap, assetRevokeMap } = useRevokeApprovals();
  const { selectedRows, handleEIP7702Revoke, refresh, isSupportedAccount } =
    useEIP7702Approvals();

  const { displaySortedAssetsList } = useApprovalsPage();
  const isEIP7702 = filterType === FILTER_TYPES.EIP7702;

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
    const revokeCount = isEIP7702
      ? selectedRows.length
      : revokeSummary.statics.txCount;
    const displayCount = isEIP7702
      ? selectedRows.length
      : currentRevokeList.length;
    const _buttonTitle = [
      t('page.approvals.component.RevokeButton.btnText'),
      revokeCount && ` (${displayCount})`,
    ]
      .filter(Boolean)
      .join('');

    return {
      couldSubmit: !!revokeCount,
      buttonTitle: _buttonTitle,
    };
  }, [
    isEIP7702,
    selectedRows.length,
    revokeSummary.statics.txCount,
    t,
    currentRevokeList.length,
  ]);

  const { safeOffBottom } = useSafeSizes();

  const batchRevoke = useBatchRevoke({
    account,
  });

  const handleRevoke = React.useCallback(() => {
    batchRevoke(currentRevokeList, displaySortedAssetsList);
  }, [batchRevoke, currentRevokeList, displaySortedAssetsList]);

  const onRevoke = async () => {
    if (isEIP7702) {
      await handleEIP7702Revoke();
      refresh();
      return;
    }
    return handleRevoke();
  };

  const isEip7702Unsupported = isEIP7702 && !isSupportedAccount;
  const isButtonDisabled = isEip7702Unsupported || !couldSubmit;

  return (
    <View
      style={[
        styles.bottomDockArea,
        isAndroid && { paddingBottom: safeOffBottom },
      ]}>
      <Button
        disabled={isButtonDisabled}
        title={buttonTitle}
        onPress={onRevoke}
        buttonStyle={[
          styles.buttonContainer,
          isEip7702Unsupported && styles.disabledButton,
        ]}
      />
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
    borderRadius: 16,
  },
  disabledButton: {
    opacity: 0.5,
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
  const { styles, isLight } = useTheme2024({
    getStyle: getNotMatchedHolderStyle,
  });
  const RcIconNotFound = useMemo(
    () => (isLight ? RcIconEmptyToken : RcIconEmptyTokenDark),
    [isLight],
  );
  return (
    <View style={[styles.container, style]}>
      <RcIconNotFound width={159} height={117} />
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
        buttonStyle={[styles.buttonStyle]}
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
      width: '100%',
      height: 56,
    },
    buttonStyle: {
      borderRadius: 16,
    },
    footerText: {
      color: colors['neutral-title2'],
    },
    disabledFooterText: {
      color: colors['neutral-title2'],
    },
  };
});
