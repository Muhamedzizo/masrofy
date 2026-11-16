import "@/global.css";
import "react-native-reanimated";
import "@/lib/_core/nativewind-pressable";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/lib/theme-provider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#F7F5EF" }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#F7F5EF" },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="review"
              options={{ presentation: "card", animation: "slide_from_left" }}
            />
            <Stack.Screen
              name="add-expense"
              options={{ presentation: "card", animation: "slide_from_bottom" }}
            />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <StatusBar style="dark" />
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
