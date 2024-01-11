import * as React from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { View, StyleSheet, Button, Text } from 'react-native';

const appErrorHandler = (error: Error) => {};

const ErrorFallback: React.ComponentType<FallbackProps> = ({
  resetErrorBoundary,
}) => {
  return (
    <View style={[styles.container]}>
      <View>
        <Text> Something went wrong: </Text>
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
  },
});

export default AppErrorBoundary;
