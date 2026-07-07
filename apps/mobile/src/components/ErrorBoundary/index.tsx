import * as React from 'react';
import { View, StyleSheet, Button, ScrollView } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { Text } from '@/components/Typography';
import Clipboard from '@react-native-clipboard/clipboard';
import { APP_RUNTIME_ENV } from '@/constant/env';

const SHOULD_SHOW_ERROR_DETAILS = APP_RUNTIME_ENV !== 'production';

function stringifyUnknownError(error: unknown) {
  try {
    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (error != null) {
      return JSON.stringify(error);
    }
  } catch {
    // Fallback below handles circular objects or hostile toJSON methods.
  }

  return String(error);
}

function getErrorDetails(error: unknown, componentStack?: string) {
  const sections: string[] = [];

  if (error instanceof Error) {
    sections.push(`Name: ${error.name || 'Error'}`);
    sections.push(`Message: ${error.message || '(empty)'}`);

    if (error.stack) {
      sections.push(`JS stack:\n${error.stack}`);
    }
  } else {
    sections.push(`Error: ${stringifyUnknownError(error)}`);
  }

  if (componentStack) {
    sections.push(`React component stack:\n${componentStack}`);
  }

  return sections.join('\n\n');
}

const appErrorHandler = (error: Error, info?: React.ErrorInfo) => {
  console.warn('[AppErrorBoundary::appErrorHandler] error occured');
  console.error(error);

  if (SHOULD_SHOW_ERROR_DETAILS) {
    console.error(getErrorDetails(error, info?.componentStack || undefined));
  }

  Sentry.captureException(error, scope => {
    scope.setTransactionName('AppErrorBoundary');
    return scope;
  });
};

const ErrorFallback = ({
  error,
  resetErrorBoundary,
  componentStack,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
  componentStack?: string;
}) => {
  const message = stringifyUnknownError(error) || 'Unknown error';
  const details = getErrorDetails(error, componentStack);

  const handleCopy = () => {
    Clipboard.setString(details);
  };

  return (
    <View style={[styles.container]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>{`Something went wrong: ${message}`}</Text>
        {SHOULD_SHOW_ERROR_DETAILS ? (
          <>
            <View style={styles.actions}>
              <View style={styles.actionButton}>
                <Button title="Copy Error Info" onPress={handleCopy} />
              </View>
              <View style={styles.actionButton}>
                <Button title="Try Again" onPress={resetErrorBoundary} />
              </View>
            </View>
            <Text style={styles.sectionTitle}>Error details</Text>
            <Text selectable style={styles.detailsText}>
              {details}
            </Text>
          </>
        ) : (
          <Button title="Try Again" onPress={resetErrorBoundary} />
        )}
      </ScrollView>
    </View>
  );
};

type AppErrorBoundaryState = {
  error: Error | null;
  componentStack?: string;
};

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
    componentStack: undefined,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack || undefined });
    appErrorHandler(error, info);
  }

  resetErrorBoundary = () => {
    this.setState({ error: null, componentStack: undefined });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          componentStack={this.state.componentStack}
          resetErrorBoundary={this.resetErrorBoundary}
        />
      );
    }

    return this.props.children;
  }
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  detailsText: {
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    color: '#111827',
    fontSize: 11,
    lineHeight: 16,
    padding: 10,
  },
});

export default AppErrorBoundary;
