import { Component, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error ?? "An unexpected error occurred."}
          </Text>
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#091411",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  title: {
    color: "#f3f4ef",
    fontSize: 24,
    fontWeight: "800",
  },
  message: {
    color: "#adc1bb",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#10211d",
  },
  buttonText: {
    color: "#f8f7f1",
    fontWeight: "800",
  },
});
