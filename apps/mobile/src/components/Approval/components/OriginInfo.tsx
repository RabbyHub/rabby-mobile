import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { findChain } from '@/utils/chain';
import { CHAINS, Chain } from '@debank/common';
import React, { useEffect, useMemo } from 'react';
import SecurityLevelTagNoText from './SecurityEngine/SecurityLevelTagNoText';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { useApprovalSecurityEngine } from '../hooks/useApprovalSecurityEngine';
import { dappService } from '@/core/services';
import { Image, StyleSheet, Text, View } from 'react-native';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeStyles } from '@/hooks/theme';
import { DappInfo } from '@/core/services/dappService';
import { Tip } from '@/components';

interface Props {
  chain?: Chain;
  origin?: string;
  originLogo?: string;
  engineResults?: Result[];
}

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    dappIcon: {
      width: 24,
      height: 24,
    },
    requestOrigin: {
      position: 'relative',
      paddingTop: 10,
      paddingBottom: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    originText: {
      color: colors['neutral-title-1'],
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      fontSize: 16,
      lineHeight: 18,
      fontWeight: '500',
    },
    chainLogo: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      width: 14,
      height: 14,
      borderRadius: 14,
    },
    originLogo: {
      position: 'relative',
      marginRight: 8,
    },
  });

export const OriginInfo: React.FC<Props> = ({
  origin,
  chain,
  originLogo,
  engineResults = [],
}) => {
  const security = useApprovalSecurityEngine();
  const [connectedSite, setConnectedSite] = React.useState<DappInfo | null>(
    null,
  );
  const { styles } = useThemeStyles(getStyle);

  const currentChain = useMemo(() => {
    if (origin === INTERNAL_REQUEST_ORIGIN) {
      return chain || CHAINS.ETH;
    } else {
      if (!connectedSite) {
        return CHAINS.ETH;
      }
      return findChain({
        enum: connectedSite.chainId,
      })!;
    }
  }, [chain, origin, connectedSite]);

  const displayOrigin = useMemo(() => {
    if (origin === INTERNAL_REQUEST_ORIGIN) {
      return 'Rabby Wallet';
    }
    return origin;
  }, [origin]);

  useEffect(() => {
    if (origin) {
      const result = dappService.getDapp(origin);
      result && setConnectedSite(result);
    }
  }, [origin]);

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const handleClickRule = (id: string) => {
    const rule = security.rules.find(item => item.id === id);
    if (!rule) {
      return;
    }
    const result = engineResultMap[id];
    security.openRuleDrawer({
      ruleConfig: rule,
      value: result?.value,
      level: result?.level,
      ignored: security.currentTx.processedRules.includes(id),
    });
  };

  const init = async () => {
    security.init();
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!origin) {
    return null;
  }

  return (
    <View style={styles.requestOrigin}>
      <View style={styles.originLogo}>
        <DappIcon
          origin={origin}
          source={{ uri: originLogo }}
          style={styles.dappIcon}
        />
        <Tip content={<Text>{currentChain.name}</Text>}>
          <Image style={styles.chainLogo} source={{ uri: currentChain.logo }} />
        </Tip>
      </View>
      <Text style={styles.originText}>{displayOrigin}</Text>
      {engineResultMap['1088'] && (
        <SecurityLevelTagNoText
          enable={engineResultMap['1088'].enable}
          level={
            security.currentTx.processedRules.includes('1088')
              ? 'proceed'
              : engineResultMap['1088'].level
          }
          onClick={() => handleClickRule('1088')}
          right={-14}
        />
      )}
      {engineResultMap['1089'] && (
        <SecurityLevelTagNoText
          enable={engineResultMap['1089'].enable}
          level={
            security.currentTx.processedRules.includes('1089')
              ? 'proceed'
              : engineResultMap['1089'].level
          }
          onClick={() => handleClickRule('1089')}
          right={-14}
        />
      )}
    </View>
  );
};
