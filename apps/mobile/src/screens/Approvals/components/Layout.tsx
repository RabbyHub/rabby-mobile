import React, { useMemo, useCallback } from 'react';
import { Platform, View, Text, Dimensions } from 'react-native';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { Button } from '@/components';

import { useTranslation } from 'react-i18next';
import { createGetStyles } from '@/utils/styles';

import { useSafeAndroidBottomOffset } from '@/hooks/useAppLayout';
import { NFTBadgeType } from '../utils';

const isAndroid = Platform.OS === 'android';

export const ApprovalsLayouts = {
  tabbarHeight: 44,
  bottomAreaHeight: 100,

  contractCardHeight: 108,
  contractCardPadding: 16,

  assetsItemHeight: 60,
  assetsItemPadding: 16,

  listFooterComponentHeight: 56,
  innerContainerHorizontalOffset: 20,
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

  const { canSubmit, isSubmitLoading } = useMemo(() => {
    return {
      isSubmitLoading: false,
      canSubmit: true,
    };
  }, []);

  const { androidBottomOffset } = useSafeAndroidBottomOffset(
    ApprovalsLayouts.bottomAreaHeight,
  );

  return (
    <View
      style={[styles.bottomDockArea, { paddingBottom: androidBottomOffset }]}>
      <Button
        disabled={!canSubmit}
        containerStyle={styles.buttonContainer}
        titleStyle={styles.buttonText}
        type="primary"
        title={t('page.approvals.component.RevokeButton.btnText', {
          // count: revokeList.length,
          count: 0,
        })}
        loading={isSubmitLoading}
        onPress={() => {}}
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
