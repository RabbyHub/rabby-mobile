import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import SecurityLevelTag from '../SecurityEngine/SecurityLevelTagNoText';
import IconEdit from '@/assets/icons/approval/editpen.svg';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { Tip } from '@/components/Tip';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    ruleResultWrapper: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 56,
      padding: 15,
      paddingRight: 24,
      backgroundColor: colors['neutral-card-2'],
      border: 'none',
      borderRadius: 8,
      marginBottom: 8,
      position: 'relative',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    ruleDesc: {
      fontWeight: '400',
      fontSize: 13,
      lineHeight: 15,
      color: colors['neutral-body'],
      width: '49%',
    },
    ruleValue: {
      display: 'flex',
      justifyContent: 'flex-end',
      fontWeight: '500',
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title-1'],
    },
    collectList: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
    },
    collectListItemImage: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
  });

const RuleResult = ({
  rule,
  collectList,
  popularLevel,
  ignored,
  hasSafe,
  hasForbidden,
  userListResult,
  onSelect,
  onEditUserList,
}: {
  rule: { id: string; desc: string; result: Result | null };
  collectList: { name: string; logo_url: string }[];
  popularLevel: string | null;
  ignored: boolean;
  hasSafe: boolean;
  hasForbidden: boolean;
  userListResult?: Result;
  onSelect(rule: { id: string; desc: string; result: Result | null }): void;
  onEditUserList(): void;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const handleClick = () => {
    if (!rule.result) return;
    onSelect({
      ...rule,
      id: rule.result.id,
    });
  };

  const translucent = useMemo(() => {
    if (!rule.result) return false;
    if (rule.result.level === Level.FORBIDDEN) {
      return false;
    } else if (rule.result.level === Level.SAFE) {
      return hasForbidden;
    } else if (
      rule.result.level === Level.ERROR ||
      !rule.result.enable ||
      ignored
    ) {
      return false;
    } else {
      if (hasForbidden) {
        return false;
      } else {
        return hasSafe;
      }
    }
  }, [hasSafe, hasForbidden, rule, ignored]);

  const ruleDesc = () => {
    if (rule.id === '1004') {
      return <>{t('page.connect.listedBy')}</>;
    }
    if (rule.id === '1005') {
      return <>{t('page.connect.sitePopularity')}</>;
    }
    if (rule.id === '1006' || rule.id === '1007') {
      return <>{t('page.connect.markRuleText')}</>;
    }
    if (rule.result) {
      if (
        (rule.id === '1002' || rule.id === '1001' || rule.id === '1003') &&
        [Level.DANGER, Level.FORBIDDEN, Level.WARNING].includes(
          rule.result.level,
        )
      ) {
        return rule.desc.replace(/Phishing check/, 'Flagged');
      } else {
        return rule.desc;
      }
    }
  };

  return (
    <View style={styles.ruleResultWrapper}>
      <Text style={styles.ruleDesc} className="flex items-center">
        {ruleDesc()}
      </Text>
      <View style={styles.ruleValue}>
        {rule.id === '1004' && (
          <Text style={styles.collectList}>
            {collectList.length <= 0 && t('page.connect.noWebsite')}
            {collectList.length > 0 &&
              collectList.slice(0, 10).map(item => (
                <View className="collect-list-item">
                  <Tip content={item.name} placement="top">
                    <Image
                      style={styles.collectListItemImage}
                      source={{ uri: item.logo_url }}
                    />
                  </Tip>
                </View>
              ))}
          </Text>
        )}
        {rule.id === '1005' && (
          <Text>
            {popularLevel === 'high' && t('page.connect.popularLevelHigh')}
            {popularLevel === 'medium' && t('page.connect.popularLevelMedium')}
            {popularLevel === 'low' && t('page.connect.popularLevelLow')}
            {popularLevel === 'very_low' &&
              t('page.connect.popularLevelVeryLow')}
          </Text>
        )}
        {['1001', '1002', '1003'].includes(rule.id) && rule.result && (
          <Text>
            {rule.result.value
              ? t('page.securityEngine.yes')
              : t('page.securityEngine.no')}
          </Text>
        )}
        {(rule.id === '1006' || rule.id === '1007') && (
          <TouchableOpacity
            className="flex flex-row items-center"
            onPress={onEditUserList}>
            <Text>
              {!userListResult && t('page.connect.noMark')}
              {userListResult &&
                userListResult.id === '1006' &&
                t('page.connect.blocked')}
              {userListResult &&
                userListResult.id === '1007' &&
                t('page.connect.trusted')}
            </Text>
            <View className="ml-6">
              <IconEdit />
            </View>
          </TouchableOpacity>
        )}
        {rule.id === '1070' && rule.result && (
          <Text>
            {rule.result.value
              ? t('page.securityEngine.yes')
              : t('page.securityEngine.no')}
          </Text>
        )}
      </View>
      {rule.result && !ignored && rule.result.enable && (
        <SecurityLevelTag
          enable
          level={rule.result.level}
          onClick={handleClick}
          translucent={translucent}
          right={-12}
        />
      )}
      {rule.result && !rule.result.enable && (
        <SecurityLevelTag
          enable={false}
          level="proceed"
          onClick={handleClick}
          right={-12}
        />
      )}
      {rule.result && ignored && (
        <SecurityLevelTag
          enable={rule.result.enable}
          level="proceed"
          onClick={handleClick}
          right={-12}
        />
      )}
    </View>
  );
};

export default RuleResult;
