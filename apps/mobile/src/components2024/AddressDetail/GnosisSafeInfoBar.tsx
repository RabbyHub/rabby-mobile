import { Chain } from '@/constant/chains';
import { AppColorsVariants } from '@/constant/theme';
import { apisSafe } from '@/core/apis/safe';
import { useAccounts } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { BasicSafeInfo } from '@rabby-wallet/gnosis-sdk';
import { useRequest } from 'ahooks';
import { sortBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { GnosisAdminItem } from './GnosisAdminItem';
import { Item } from './Item';

export const GnosisSafeInfoBar = ({
  address,
}: {
  address: string;
  type: string;
  brandName: string;
}) => {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const [activeData, setActiveData] = useState<
    | {
        chain?: Chain | null;
        data: BasicSafeInfo;
      }
    | undefined
  >(undefined);

  const { accounts } = useAccounts();
  const { data: safeInfo } = useRequest(
    async () => {
      const networks = await apisSafe.getGnosisNetworkIds(address);
      const res = await Promise.all(
        networks.map(async networkId => {
          const info = await apisSafe.getBasicSafeInfo({ address, networkId });

          return {
            chain: findChain({
              networkId: networkId,
            }),
            data: {
              ...info,
            },
          };
        }),
      );
      const list = sortBy(res, item => {
        return -(item?.data?.owners?.length || 0);
      });
      setActiveData(list[0]);
      return list;
    },
    {
      refreshDeps: [address],
    },
  );

  useEffect(() => {
    if (address) {
      apisSafe.syncGnosisNetworks(address);
    }
  }, [address]);

  if (!safeInfo) {
    return null;
  }

  return (
    <>
      <Item label={t('page.addressDetail.admins')} />
      <Item
        style={{
          marginTop: -12,
        }}>
        <View>
          <View style={styles.tabs}>
            {safeInfo?.map(item => {
              const isAcitve = activeData?.chain?.enum === item?.chain?.enum;
              return (
                <TouchableOpacity
                  onPress={() => {
                    setActiveData(item);
                  }}
                  key={item?.chain?.enum}>
                  <View
                    style={[styles.tabItem, isAcitve && styles.tabItemActive]}>
                    <Text
                      style={[
                        styles.tabItemTitle,
                        isAcitve && styles.tabItemTitleActive,
                      ]}>
                      {item?.chain?.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.listItemDesc}>
            Any transaction requires{' '}
            <Text
              style={
                styles.listItemDescStrong
              }>{`${activeData?.data?.threshold}/${activeData?.data?.owners.length}`}</Text>{' '}
            confirmations
          </Text>
        </View>
      </Item>

      <Item
        style={{
          marginTop: -12,
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}>
        {activeData?.data?.owners.map((owner, index, list) => (
          <GnosisAdminItem
            address={owner}
            accounts={accounts.map(e => e.address)}
            key={index}
            style={
              index === list.length - 1
                ? { borderBottomWidth: 0, paddingBottom: 0 }
                : {}
            }
          />
        ))}
      </Item>
    </>
  );
};

const getStyles = (colors: AppColorsVariants) => {
  return StyleSheet.create({
    listItem: {
      marginTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors['neutral-line'],
      paddingTop: 20,
    },
    listItemContent: {},
    listItemLabel: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 8,
    },
    tabsContainer: {
      marginBottom: 10,
    },
    tabs: {
      flexDirection: 'row',
      gap: 16,
      flexWrap: 'wrap',
    },
    tabItem: {
      borderBottomColor: 'transparent',
      borderBottomWidth: 2,
    },
    tabItemTitle: {
      color: colors['neutral-body'],
      fontSize: 14,
      lineHeight: 17,
      fontWeight: '500',
    },
    tabItemTitleActive: {
      color: colors['blue-default'],
    },
    tabItemActive: {
      borderBottomColor: colors['blue-default'],
    },
    listItemDesc: {
      color: colors['neutral-foot'],
      fontSize: 14,
    },
    listItemDescStrong: {
      color: colors['neutral-title-1'],
      fontWeight: '500',
    },
  });
};
