import { Stack } from "expo-router";
import { ThemeProvider } from "../context/ThemeContext";
import Toast from "react-native-toast-message";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="modal" />
        <Stack.Screen name="scanReport" options={{ presentation: 'card' }} />
        <Stack.Screen name="motionGenerator" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      <Toast />
    </ThemeProvider>
  );
}