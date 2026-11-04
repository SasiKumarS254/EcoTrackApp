import { Stack } from "expo-router";
import { ThemeProvider } from "../context/ThemeContext";
import Toast from "react-native-toast-message";
import { View, Text, Platform, Alert } from "react-native";

if (Platform.OS === "web") {
  const originalAlert = Alert.alert;
  Alert.alert = (title, message, buttons) => {
    if (!buttons || buttons.length <= 1) {
      const isErr = title && (title.includes('Error') || title.includes('Fail') || title.includes('Denied') || title.includes('Invalid') || title.includes('Missing'));
      const isSuccess = title && (title.includes('Success') || title.includes('Confirmed') || title.includes('Shared') || title.includes('🎉') || title.includes('✅'));
      Toast.show({
        type: isErr ? 'error' : (isSuccess ? 'success' : 'info'),
        text1: title,
        text2: message,
        position: 'top',
        topOffset: 50
      });
      if (buttons && buttons[0]?.onPress) buttons[0].onPress();
    } else {
      originalAlert(title, message, buttons);
    }
  };
}

const toastConfig = {
  success: (props: any) => (
    <View style={{
      minHeight: 56,
      width: '92%',
      maxWidth: 420,
      backgroundColor: '#0f172a',
      borderRadius: 16,
      borderLeftWidth: 5,
      borderLeftColor: '#10b981',
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)'
    }}>
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
      }}>
        <Text style={{ fontSize: 17 }}>✅</Text>
      </View>
      <View style={{ flex: 1 }}>
        {props.text1 ? <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>{props.text1}</Text> : null}
        {props.text2 ? <Text style={{ color: '#94a3b8', fontSize: 12.5, marginTop: 2 }}>{props.text2}</Text> : null}
      </View>
    </View>
  ),
  error: (props: any) => (
    <View style={{
      minHeight: 56,
      width: '92%',
      maxWidth: 420,
      backgroundColor: '#0f172a',
      borderRadius: 16,
      borderLeftWidth: 5,
      borderLeftColor: '#ef4444',
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)'
    }}>
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
      }}>
        <Text style={{ fontSize: 17 }}>❌</Text>
      </View>
      <View style={{ flex: 1 }}>
        {props.text1 ? <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>{props.text1}</Text> : null}
        {props.text2 ? <Text style={{ color: '#94a3b8', fontSize: 12.5, marginTop: 2 }}>{props.text2}</Text> : null}
      </View>
    </View>
  ),
  info: (props: any) => (
    <View style={{
      minHeight: 56,
      width: '92%',
      maxWidth: 420,
      backgroundColor: '#0f172a',
      borderRadius: 16,
      borderLeftWidth: 5,
      borderLeftColor: '#3b82f6',
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)'
    }}>
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
      }}>
        <Text style={{ fontSize: 17 }}>ℹ️</Text>
      </View>
      <View style={{ flex: 1 }}>
        {props.text1 ? <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>{props.text1}</Text> : null}
        {props.text2 ? <Text style={{ color: '#94a3b8', fontSize: 12.5, marginTop: 2 }}>{props.text2}</Text> : null}
      </View>
    </View>
  )
};

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="modal" />
        <Stack.Screen name="admin" options={{ presentation: 'card' }} />
        <Stack.Screen name="scanReport" options={{ presentation: 'card' }} />
        <Stack.Screen name="motionGenerator" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      <Toast config={toastConfig} />
    </ThemeProvider>
  );
}