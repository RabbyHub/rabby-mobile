import React, { useMemo, useCallback } from 'react';
import { Platform, View, Text, Dimensions, StatusBar } from 'react-native';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { Button } from '@/components';

import { useTranslation } from 'react-i18next';
import { createGetStyles } from '@/utils/styles';

import { useSafeAndroidBottomOffset } from '@/hooks/useAppLayout';
import {
  RcIconCheckedCC,
  RcIconIndeterminateCC,
  RcIconNotMatchedCC,
  RcIconUncheckCC,
} from '../icons';
import { useApprovalsPage, useRevokeApprovals } from '../useApprovalsPage';
import { apiApprovals } from '@/core/apis';
import { useRefState } from '@/hooks/common/useRefState';

const isAndroid = Platform.OS === 'android';

const riskyTipHeight = 32;
const riskyTipArrowOffset = 14;
const contractRowHeight = 108;
const contractCardHeight = 133;
export const ApprovalsLayouts = {
  tabbarHeight: 40,
  contentInsetTopOffset: isAndroid ? 0 : 40 /* same with tabbarHeight */,
  bottomAreaHeight: isAndroid ? 100 : 120,

  searchBarMarginOffset: 16,
  searchBarHeight: 48,

  contractRowHeight,
  contractRowHeightWithRiskAlert:
    contractRowHeight + riskyTipHeight + riskyTipArrowOffset,
  contractCardRiskAlertSpace: riskyTipHeight + riskyTipArrowOffset,
  contractCardHeight,
  contractCardHeightWithRiskAlert:
    contractCardHeight + riskyTipHeight + riskyTipArrowOffset,
  contractCardPadding: 14,

  assetsItemHeight: 60,
  assetsItemPadding: 16,

  listFooterComponentHeight: 56,
  innerContainerHorizontalOffset: 20,

  get scrollableSectionHeight() {
    return (
      Dimensions.get('window').height -
      (StatusBar.currentHeight || 0) -
      this.tabbarHeight -
      this.bottomAreaHeight -
      this.searchBarHeight -
      this.searchBarMarginOffset * 2 -
      (isAndroid ? 0 : this.contentInsetTopOffset + this.tabbarHeight)
    );
  },
  get riskAlertTooltipMaxWidth() {
    return (
      Dimensions.get('window').width -
      (this.innerContainerHorizontalOffset + this.contractCardPadding + 63)
    );
  },
};

export function getApprovalsSizes() {
  const contractCardW =
    Dimensions.get('window').width -
    ApprovalsLayouts.innerContainerHorizontalOffset * 2;

  return {
    contractCardW,
  };
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
  return (
    <ViewComponent
      {...props}
      style={[
        props?.style,
        {
          paddingTop: ApprovalsLayouts.tabbarHeight,
          paddingBottom: ApprovalsLayouts.bottomAreaHeight,
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

  const { filterType, loadApprovals } = useApprovalsPage();
  const { contractRevokeMap, assetRevokeMap, resetRevokeMaps } =
    useRevokeApprovals();

  const currentRevokeList = React.useMemo(() => {
    return filterType === 'contract'
      ? Object.values(contractRevokeMap)
      : filterType === 'assets'
      ? Object.values(assetRevokeMap)
      : [];
  }, [filterType, contractRevokeMap, assetRevokeMap]);

  const { couldSubmit, buttonTitle } = useMemo(() => {
    const revokeCount = currentRevokeList.length;
    const buttonTitle = [
      `${t('page.approvals.component.RevokeButton.btnText', {
        // count: revokeList.length,
        // count: revokeCount,
      })}`,
      revokeCount && ` (${revokeCount})`,
    ]
      .filter(Boolean)
      .join('');

    return {
      couldSubmit: !!revokeCount,
      buttonTitle,
    };
  }, [t, currentRevokeList]);

  const {
    state: isSubmitLoading,
    setRefState: setIsSubmitLoading,
    stateRef: isSubmitLoadingRef,
  } = useRefState(false);

  const handleRevoke = React.useCallback(() => {
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

  const { androidBottomOffset } = useSafeAndroidBottomOffset(
    ApprovalsLayouts.bottomAreaHeight,
  );

  return (
    <View
      style={[styles.bottomDockArea, { paddingBottom: androidBottomOffset }]}>
      <Button
        disabled={!couldSubmit}
        containerStyle={styles.buttonContainer}
        titleStyle={styles.buttonText}
        disabledTitleStyle={styles.buttonText}
        type="primary"
        title={buttonTitle}
        loading={isSubmitLoading}
        onPress={handleRevoke}
      />
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
  isSelectedPartials,
  style,
  size = 20,
}: {
  isSelectedAll: boolean;
  isSelectedPartials: boolean;
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

  if (isSelectedPartials) {
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

export function NotMatchedHolder({ style }: RNViewProps) {
  const { colors, styles } = useThemeStyles(getNotMatchedHolderStyle);
  return (
    <View style={[styles.container, style]}>
      <RcIconNotMatchedCC color={colors['neutral-body']} />
      <Text style={styles.emptyText}>Not Matched</Text>
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
