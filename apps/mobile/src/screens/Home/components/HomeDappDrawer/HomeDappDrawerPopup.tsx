import { AppBottomSheetModal } from '@/components/customized/BottomSheet';

import AutoLockView from '@/components/AutoLockView';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { EVENT_SHOW_BROWSER_MANAGE, eventBus } from '@/utils/events';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useTransition,
} from 'react';
import {
  BackHandler,
  View,
  Image,
  Touchable,
  TouchableOpacity,
} from 'react-native';
import { DappInfo } from '@/core/services/dappService';
import { Text } from '@/components/Typography';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { Button } from '@/components2024/Button';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import { useTranslation } from 'react-i18next';
import { useSyncDappsInfo } from '@/hooks/useSyncDappsInfo';
import hotDappList from '@/constant/hot-dapp.json';
import { uniq } from 'lodash';
const categories = uniq(hotDappList.map(item => item.category));

export const DappInfoPopup: React.FC<{
  dappInfo?: DappInfo;
  visible: boolean;
  onClose: () => void;
  isRemind?: boolean;
  onChangeRemind?: (value: boolean) => void;
  onOpenDapp?: (url: string) => void;
}> = ({ visible, onClose, dappInfo, isRemind, onChangeRemind, onOpenDapp }) => {
  const { safeOffScreenTop } = useSafeSizes();

  const { colors2024, styles } = useTheme2024({ getStyle });

  const snapPoints = useMemo(() => {
    return [494];
  }, []);

  const modalRef = useRef<AppBottomSheetModal>(null);

  console.log('render DappInfoPopup', visible, dappInfo);
  const { t } = useTranslation();

  const { data: level } = useRequest(
    async () => {
      if (!dappInfo?.origin) {
        return;
      }
      const result = await openapi.getOriginPopularityLevel(dappInfo.origin);

      const dict = {
        high: t('page.connect.popularLevelHigh'),
        medium: t('page.connect.popularLevelMedium'),
        low: t('page.connect.popularLevelLow'),
        very_low: t('page.connect.popularLevelVeryLow'),
      };

      return dict[result?.level || ''];
    },
    {
      refreshDeps: [dappInfo?.origin],
      cacheKey: `dapp-getOriginPopularityLevel-${dappInfo?.origin}`,
      staleTime: 10 * 1000,
    },
  );

  const { data: basicDappInfo = dappInfo?.info } = useRequest(
    async () => {
      if (!dappInfo?.origin) {
        return;
      }
      const res = await openapi.getDappsInfo({
        ids: [dappInfo?.origin.replace(/^https?:\/\//, '') || ''],
      });
      return res?.[0];
    },
    {
      refreshDeps: [dappInfo?.origin],
      cacheKey: `dapp-getDappsInfo-${dappInfo?.origin}`,
      staleTime: 10 * 1000,
    },
  );

  const category = useMemo(() => {
    return dappInfo?.info?.tags?.find(tag => categories.includes(tag));
  }, [dappInfo?.info?.tags]);

  const collectionList = useMemo(() => {
    return basicDappInfo?.collected_list || dappInfo?.info?.collected_list;
  }, [basicDappInfo?.collected_list, dappInfo?.info?.collected_list]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      index={visible ? 0 : -1}
      enableHandlePanningGesture
      enableContentPanningGesture={true}
      enablePanDownToClose
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicatorStyle}
      style={styles.popupStyle}
      ref={modalRef}
      keyboardBehavior="extend"
      snapPoints={snapPoints}
      onChange={index => {
        if (index === -1) {
          onClose();
        }
      }}>
      <AutoLockView as="View" style={styles.content}>
        {dappInfo ? (
          <BottomSheetScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}>
            <View style={styles.dappCard}>
              <DappIcon
                source={
                  dappInfo?.icon
                    ? {
                        uri: dappInfo.icon,
                      }
                    : undefined
                }
                origin={dappInfo.origin}
                style={styles.dappIcon}
              />
              <View style={styles.dappContent}>
                <Text style={[styles.dappTitle]} numberOfLines={1}>
                  {dappInfo?.info?.name ||
                    dappInfo.name ||
                    dappInfo.origin.split('://')[1] ||
                    dappInfo.origin}
                </Text>
                <Text style={styles.dappOrigin} numberOfLines={1}>
                  {dappInfo.origin}
                </Text>
              </View>
            </View>
            {dappInfo.info?.description ? (
              <Text style={styles.dappDesc} numberOfLines={3}>
                {dappInfo.info?.description}
              </Text>
            ) : null}
            <View style={styles.divider} />
            <View style={styles.list}>
              <View style={styles.listItem}>
                <Text style={styles.listLabel}>Listed by</Text>
                {collectionList?.length ? (
                  <View style={styles.listBy}>
                    {collectionList?.slice(0, 3).map((item, index) => (
                      <Image
                        key={index}
                        source={{
                          uri: item.logo_url,
                        }}
                        style={styles.listByIcon as any}
                      />
                    ))}
                    {collectionList?.length > 3 ? (
                      <Text style={styles.listByMore}>
                        +{collectionList?.length - 3}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listLabel}>Site popularity</Text>

                <Text style={styles.sitePopularity}>{level}</Text>
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listLabel}>Category</Text>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{category}</Text>
                </View>
              </View>
            </View>
            <View style={styles.footer}>
              <View style={styles.checkBoxContainer}>
                <TouchableOpacity
                  onPress={() => {
                    onChangeRemind?.(!isRemind);
                  }}>
                  <View style={styles.checkBoxContent}>
                    <CheckBoxRect checked={!isRemind} />
                    <Text style={styles.checkBoxText}>
                      Don’t remind anymore
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <Button
                type="primary"
                onPress={() => {
                  onOpenDapp?.(dappInfo?.url || dappInfo?.origin);
                }}
                // title={`Open ${dappInfo.info?.name || dappInfo.origin}`}
                title={({ titleStyle }) => {
                  return (
                    <Text
                      style={[
                        titleStyle,
                        {
                          paddingHorizontal: 8,
                        },
                      ]}
                      numberOfLines={1}>
                      {`Open ${dappInfo.info?.name || dappInfo.origin}`}
                    </Text>
                  );
                }}
              />
            </View>
          </BottomSheetScrollView>
        ) : null}
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    popupStyle: {
      borderRadius: 32,
      overflow: 'hidden',
    },
    handleStyle: {
      // backgroundColor: isLight
      //   ? colors2024['neutral-bg-0']
      //   : colors2024['neutral-bg-1'],
      backgroundColor: colors2024['neutral-bg-1'],
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
    },
    handleIndicatorStyle: {
      backgroundColor: colors2024['neutral-bg-5'],
      height: 6,
      width: 50,
    },

    content: {
      flex: 1,
      backgroundColor: colors2024['neutral-bg-1'],
      paddingHorizontal: 24,
      paddingTop: 24,
      // backgroundColor: isLight
      //   ? colors2024['neutral-bg-0']
      //   : colors2024['neutral-bg-1'],
    },
    scrollView: {
      height: '100%',
      paddingBottom: 56,
      display: 'flex',
      flexDirection: 'column',
    },
    scrollViewContent: {
      flexGrow: 1,
    },

    dappCard: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      gap: 8,
    },
    dappIcon: {
      width: 46,
      height: 46,
      borderRadius: 12,
      borderCurve: 'continuous',
    },
    dappTitle: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 20,
      color: colors2024['neutral-title-1'],
    },
    dappContent: {
      minWidth: 0,
      flex: 1,
    },
    dappOrigin: {
      marginTop: 4,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 13,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
    },

    dappDesc: {
      marginTop: 12,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 24,
      color: colors2024['neutral-secondary'],
    },

    divider: {
      marginVertical: 12,
      height: 1,
      backgroundColor: colors2024['neutral-bg-5'],
    },

    list: { flex: 1 },

    listItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    listLabel: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
    },
    listBy: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    listByIcon: {
      width: 12,
      height: 12,
      borderRadius: 1000,
    },
    listByMore: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
    },
    sitePopularity: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 20,
      color: colors2024['neutral-title-1'],
    },
    tag: {
      backgroundColor: colors2024['neutral-bg-5'],
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
    },
    tagText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
      color: colors2024['neutral-secondary'],
    },

    footer: {
      marginTop: 'auto',
    },

    checkBoxContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    checkBoxContent: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    checkBoxText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
      color: colors2024['neutral-secondary'],
    },
  };
});
