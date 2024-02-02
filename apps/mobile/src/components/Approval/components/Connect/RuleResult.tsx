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
import useCommonStyle from '../../hooks/useCommonStyle';

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
      flexDirection: 'row',
      flex: 1,
      fontWeight: '500',
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title-1'],
    },
    collectList: {
      display: 'flex',
      flexWrap: 'wrap',
      flexDirection: 'row',
      gap: 8,
      flex: 1,
    },
    collectListItemImage: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    icon: {
      marginLeft: 6,
    },
    markButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tag: {
      marginTop: 2,
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
  const commonStyle = useCommonStyle();
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
      return t('page.connect.listedBy');
    }
    if (rule.id === '1005') {
      return t('page.connect.sitePopularity');
    }
    if (rule.id === '1006' || rule.id === '1007') {
      return t('page.connect.markRuleText');
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
          <View style={styles.collectList}>
            {collectList.length <= 0 && (
              <Text style={commonStyle.primaryText}>
                {t('page.connect.noWebsite')}
              </Text>
            )}
            {collectList.length > 0 &&
              collectList.slice(0, 10).map((item, idx) => (
                <View
                  key={`${item.name}-${item.logo_url}-${idx}`}
                  className="collect-list-item">
                  <Tip content={item.name} placement="top">
                    <Image
                      style={styles.collectListItemImage}
                      source={{ uri: item.logo_url }}
                    />
                  </Tip>
                </View>
              ))}
          </View>
        )}
        {rule.id === '1005' && (
          <Text style={commonStyle.primaryText}>
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
          <TouchableOpacity style={styles.markButton} onPress={onEditUserList}>
            <Text style={commonStyle.primaryText}>
              {!userListResult && t('page.connect.noMark')}
              {userListResult &&
                userListResult.id === '1006' &&
                t('page.connect.blocked')}
              {userListResult &&
                userListResult.id === '1007' &&
                t('page.connect.trusted')}
            </Text>
            <View style={styles.icon}>
              <IconEdit />
            </View>
          </TouchableOpacity>
        )}
        {rule.id === '1070' && rule.result && (
          <Text style={commonStyle.primaryText}>
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
          style={styles.tag}
        />
      )}
      {rule.result && !rule.result.enable && (
        <SecurityLevelTag
          enable={false}
          level="proceed"
          onClick={handleClick}
          right={-12}
          style={styles.tag}
        />
      )}
      {rule.result && ignored && (
        <SecurityLevelTag
          enable={rule.result.enable}
          level="proceed"
          onClick={handleClick}
          right={-12}
          style={styles.tag}
        />
      )}
    </View>
  );
};

export default RuleResult;
