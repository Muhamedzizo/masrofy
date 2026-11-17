import "@/global.css";
import "react-native-reanimated";
import "@/lib/_core/nativewind-pressable";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/lib/theme-provider";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "@/lib/trpc";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTRPCClient());
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#F7F5EF" }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
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
                  options={{
                    presentation: "card",
                    animation: "slide_from_left",
                  }}
                />
                <Stack.Screen
                  name="add-expense"
                  options={{
                    presentation: "card",
                    animation: "slide_from_bottom",
                  }}
                />
                <Stack.Screen
                  name="wallet"
                  options={{ presentation: "card", animation: "slide_from_right" }}
                />
                <Stack.Screen
                  name="reports"
                  options={{ presentation: "card", animation: "slide_from_right" }}
                />
                <Stack.Screen name="oauth/callback" />
              </Stack>
              <StatusBar style="dark" />
            </SafeAreaProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );
}
