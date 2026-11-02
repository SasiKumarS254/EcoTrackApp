import { Tabs, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Elevated Center AI Scan Floating Action Button
function CenterScanButton(props: any) {
  const { colors, isDark } = useTheme();
  const isSelected = props.accessibilityState?.selected;

  return (
    <TouchableOpacity
      {...props}
      style={{
        top: -14,
        justifyContent: "center",
        alignItems: "center",
        flex: 1,
      }}
      activeOpacity={0.88}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: "#10b981",
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 3.5,
          borderColor: colors.bgCard,
          shadowColor: "#10b981",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 8,
          elevation: 10,
        }}
      >
        <LinearGradient
          colors={isSelected ? ["#10b981", "#047857"] : ["#10b981", "#059669"]}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 24,
            justifyContent: "center",
            alignItems: "center",
          }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="scan" size={26} color="#ffffff" />
        </LinearGradient>
      </View>
      <Text
        style={{
          fontSize: 10,
          fontWeight: "800",
          color: isSelected ? colors.primary : colors.textMuted,
          marginTop: 2,
        }}
      >
        AI Scan
      </Text>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await AsyncStorage.getItem("@ecotrack_user_session");
        if (!session) {
          const loggedOut = await AsyncStorage.getItem("@ecotrack_logged_out");
          if (loggedOut === "true") {
            router.replace("/auth/login");
            return;
          }
          await AsyncStorage.setItem("@ecotrack_user_session", JSON.stringify({
            id: "usr1",
            user_id: "usr1",
            email: "user@ecotrack.org",
            name: "Eco Explorer",
            display_name: "Eco Explorer",
            avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
            avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
            reputation_score: 100,
            role: "user",
            loggedInAt: new Date().toISOString(),
          }));
          await AsyncStorage.setItem("@ecotrack_user_id", "usr1");
        }
        setCheckingAuth(false);
      } catch (e) {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  if (checkingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bgLight }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 62 + (insets.bottom > 0 ? insets.bottom : 8),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          paddingTop: 6,
          backgroundColor: colors.bgCard,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 2 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      {/* 1. DASHBOARD */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "speedometer" : "speedometer-outline"} size={21} color={color} />
          ),
        }}
      />

      {/* 2. SPECIES TRAINER */}
      <Tabs.Screen
        name="training"
        options={{
          title: "Trainer",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "barbell" : "barbell-outline"} size={21} color={color} />
          ),
        }}
      />

      {/* 3. AI SCANNER (Elevated Center Floating Action Button) */}
      <Tabs.Screen
        name="aiscanner"
        options={{
          title: "AI Scan",
          tabBarButton: (props) => <CenterScanButton {...props} />,
        }}
      />

      {/* 4. COMMUNITY FEED */}
      <Tabs.Screen
        name="community"
        options={{
          title: "Community",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={21} color={color} />
          ),
        }}
      />

      {/* 5. EXPLORE HUB (Marketplace, Events & Care Services) */}
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "grid" : "grid-outline"} size={21} color={color} />
          ),
        }}
      />

      {/* ---------------- HIDDEN MODULES (Accessible via Explore Hub) ---------------- */}

      {/* Boutique Marketplace */}
      <Tabs.Screen
        name="marketplace"
        options={{
          href: null,
        }}
      />

      {/* Events & Pass Vault */}
      <Tabs.Screen
        name="events"
        options={{
          href: null,
        }}
      />

      {/* Find Animal Care Services */}
      <Tabs.Screen
        name="maps"
        options={{
          href: null,
        }}
      />

      {/* Profile (Accessible via top-right profile avatar across all headers) */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />

      {/* Legacy Encyclopedia Hidden */}
      <Tabs.Screen
        name="encyclopedia"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
