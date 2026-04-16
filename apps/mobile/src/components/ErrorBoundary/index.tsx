import * as React from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { View, StyleSheet, Button } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { Text } from '@/components/Typography';

const appErrorHandler = (error: Error) => {
  console.warn('[AppErrorBoundary::appErrorHandler] error occured');
  console.error(error);
  Sentry.captureException(error, scope => {
    scope.setTransactionName('AppErrorBoundary');
    return scope;
  });
};

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  let message = 'Unknown error';

  try {
    if (typeof error === 'string') {
      message = error;
    } else if (error instanceof Error) {
      message = error.message;
    } else if (error != null) {
      message = JSON.stringify(error);
    }
  } catch {
    message = String(error);
  }
  return (
    <View style={[styles.container]}>
      <View>
        <Text>{`Something went wrong: ${message}`}</Text>
        <Button title="Try Again" onPress={resetErrorBoundary} />
      </View>
    </View>
  );
};
function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={appErrorHandler}>
      {children}
    </ErrorBoundary>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    alignContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
});

export default AppErrorBoundary;
