import { apisSafe } from '@/core/apis/safe';
import { useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { useGnosisNetworks } from '@/hooks/gnosis/useGnosisNetworks';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { useRequest } from 'ahooks';
import { sortBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { GnosisAdminItem } from './GnosisAdminItem';
import { Item } from './Item';
import { Text } from '@/components/Typography';

export const GnosisSafeInfoBar = ({
  address,
  active = true,
}: {
  address: string;
  active?: boolean;
  type: string;
  brandName: string;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const [activeNetworkId, setActiveNetworkId] = useState<string>();
  const { data: networks } = useGnosisNetworks({ address, active });
  const networksKey = networks?.join(',');
  const { accounts } = useAccounts();
  const { data: safeInfo, cancel } = useRequest(
    async () => {
      const results = await Promise.allSettled(
        (networks || []).map(async networkId => ({
          networkId,
          chain: findChain({ networkId }),
          data: await apisSafe.getBasicSafeInfo({ address, networkId }),
        })),
      );
      return {
        address,
        list: sortBy(
          results.flatMap(result =>
            result.status === 'fulfilled' && result.value.chain
              ? [result.value]
              : [],
          ),
          item => -(item.data.owners.length || 0),
        ),
      };
    },
    {
      ready: active && networks !== undefined,
      refreshDeps: [address, networksKey],
    },
  );
  useEffect(() => {
    if (!active) {
      cancel();
    }
  }, [active, cancel]);

  const availableInfo = useMemo(
    () =>
      safeInfo?.address === address
        ? safeInfo.list.filter(item => networks?.includes(item.networkId))
        : [],
    [address, networks, safeInfo],
  );
  const activeData =
    availableInfo.find(item => item.networkId === activeNetworkId) ||
    availableInfo[0];

  useEffect(() => {
    setActiveNetworkId(activeData?.networkId);
  }, [activeData?.networkId]);

  if (!activeData) {
    return null;
  }

  return (
    <>
      <Item label={t('page.addressDetail.admins')} />
      <Item style={styles.subItem}>
        <View>
          <View style={styles.tabs}>
            {availableInfo.map(item => {
              const isAcitve = activeData.networkId === item.networkId;
              return (
                <TouchableOpacity
                  onPress={() => {
                    setActiveNetworkId(item.networkId);
                  }}
                  key={item.networkId}>
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
            <Trans key="page.addressDetail.tx-requires">
              Any transaction requires{' '}
              <Text
                style={
                  styles.listItemDescStrong
                }>{`${activeData?.data?.threshold}/${activeData?.data?.owners.length}`}</Text>{' '}
              confirmations
            </Trans>
          </Text>
        </View>
      </Item>

      <Item
        style={{
          marginTop: -24,
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  listItem: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors2024['neutral-line'],
    paddingTop: 20,
  },
  subItem: {
    marginTop: -12,
  },
  listItemContent: {},
  listItemLabel: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
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
    color: colors2024['neutral-body'],
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  tabItemTitleActive: {
    color: colors2024['brand-default'],
  },
  tabItemActive: {
    borderBottomColor: colors2024['brand-default'],
  },
  listItemDesc: {
    color: colors2024['neutral-foot'],
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    marginTop: 8,
  },
  listItemDescStrong: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
}));
