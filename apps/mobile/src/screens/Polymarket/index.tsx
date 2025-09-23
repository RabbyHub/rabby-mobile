import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePolymarket } from '@/screens/Polymarket/hooks/usePolymarket';
import { toast } from '@/components2024/Toast';

export const PolymarketScreen = () => {
  const { t } = useTranslation();
  const { colors2024, styles } = useTheme2024({ getStyle: getStyles });
  const navigation = useRabbyAppNavigation();
  const { isAuthenticated, isLoading, error, authenticate } = usePolymarket();

  const handleViewMarkets = () => {
    navigation.navigate(RootNames.StackTransaction, {
      screen: RootNames.PolymarketMarketList,
      params: {},
    });
  };

  const handleAuthenticate = async () => {
    const success = await authenticate();
    if (success) {
      toast.success('Successfully authenticated with Polymarket');
    } else {
      toast.error('Failed to authenticate with Polymarket');
    }
  };

  return (
    <NormalScreenContainer2024>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Polymarket</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Polymarket</Text>
        <Text style={styles.subtitle}>
          Prediction markets powered by blockchain technology
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.authBox}>
          <Text style={styles.sectionTitle}>Authentication</Text>
          {isAuthenticated ? (
            <Text style={styles.authStatus}>✓ Connected to Polymarket</Text>
          ) : (
            <TouchableOpacity
              style={styles.authButton}
              onPress={handleAuthenticate}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color={colors2024['neutral-title-1']} />
              ) : (
                <Text style={styles.authButtonText}>Connect Wallet</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.featureBox}>
          <Text style={styles.featureTitle}>Features</Text>
          <TouchableOpacity
            style={styles.featureButton}
            onPress={handleViewMarkets}
            disabled={!isAuthenticated || isLoading}>
            <Text style={styles.featureButtonText}>Browse Markets</Text>
          </TouchableOpacity>
        </View>
      </View>
    </NormalScreenContainer2024>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors2024['neutral-title-1'],
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors2024['neutral-title-1'],
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors2024['neutral-body'],
    textAlign: 'center',
    marginBottom: 30,
  },
  errorBox: {
    backgroundColor: colors2024['red-default'],
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
  },
  authBox: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors2024['neutral-title-1'],
    marginBottom: 15,
  },
  authStatus: {
    fontSize: 16,
    color: colors2024['green-default'],
    fontWeight: '600',
  },
  authButton: {
    backgroundColor: colors2024['brand-default'],
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  authButtonText: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '600',
  },
  featureBox: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    padding: 20,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors2024['neutral-title-1'],
    marginBottom: 15,
  },
  featureButton: {
    backgroundColor: colors2024['brand-default'],
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  featureButtonText: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '600',
  },
}));

export default PolymarketScreen;
