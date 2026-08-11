/**
 * motionGenerator.tsx — 3D Motion Visualization for EcoTrack
 *
 * Renders a Three.js scene in a WebView to visualize the detected
 * species and exercise motion in 3D.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Text } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import { generateMotionViewerHTML } from '../lib/motionGenerator';
import { useTheme } from '../context/ThemeContext';

export default function MotionGeneratorScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();

  const species = (params.species as string) || 'human';
  const exerciseId = (params.exerciseId as string) || 'squat';
  const jointAngles = useMemo(() => {
    try {
      return params.jointAngles ? JSON.parse(params.jointAngles as string) : {};
    } catch {
      return {};
    }
  }, [params.jointAngles]);

  const html = useMemo(() =>
    generateMotionViewerHTML(species, exerciseId, jointAngles),
    [species, exerciseId, jointAngles]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>3D Motion Analysis</Text>
          <Text style={styles.subtitle}>{species.toUpperCase()} · {exerciseId.replace('_', ' ').toUpperCase()}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* WebView Renderer */}
      <View style={styles.rendererContainer}>
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.webview}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <View style={styles.infoBadge}>
          <Ionicons name="cube-outline" size={14} color="#10b981" />
          <Text style={styles.infoText}>Real-time WebGL Rendering</Text>
        </View>
        <Text style={styles.footerNote}>
          Drag to rotate · Pinch to zoom
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)'
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitleContainer: { alignItems: 'center' },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  subtitle: { color: '#94a3b8', fontSize: 10, fontWeight: '700', marginTop: 2 },
  rendererContainer: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  footer: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)'
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8
  },
  infoText: { color: '#10b981', fontSize: 11, fontWeight: '800' },
  footerNote: { color: '#64748b', fontSize: 12, fontWeight: '600' },
});
