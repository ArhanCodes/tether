import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { PhoneFrame } from "./src/components/PhoneFrame";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <ErrorBoundary>
      <PhoneFrame>
        <AppNavigator />
      </PhoneFrame>
    </ErrorBoundary>
  );
}
