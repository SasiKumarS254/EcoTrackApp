import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, Alert, StatusBar, Dimensions, ActivityIndicator,
  FlatList, Modal
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize, Spacing } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { fetchTaxonomySpecies } from "../../services/api";
import { fetchWikipediaSpeciesData } from "../../services/wikipedia";

const { width } = Dimensions.get("window");

const CLASSES = ["All", "Mammalia", "Aves", "Reptilia", "Amphibia", "Actinopterygii", "Chondrichthyes"];

export default function EncyclopediaScreen() {
  const { colors, isDark } = useTheme();

  const [species, setSpecies] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeClass, setActiveClass] = useState("All");
  const [isLoading, setIsLoading] = useState(false);

  const [selectedSpecies, setSelectedSpecies] = useState<any>(null);
  const [wikiData, setWikiData] = useState<any>(null);
  const [loadingWiki, setLoadingWiki] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSpecies();
    }, [activeClass])
  );

  const loadSpecies = async (query = "") => {
    try {
      setIsLoading(true);
      const res = await fetchTaxonomySpecies(query, activeClass);
      if (res) {
        setSpecies(res);
      }
    } catch (e) {
      console.warn("Encyclopedia fetch error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    loadSpecies(search);
  };

  const openDetails = async (item: any) => {
    setSelectedSpecies(item);
    setWikiData(null);
    setLoadingWiki(true);
    try {
      const data = await fetchWikipediaSpeciesData(item.scientific_name || item.common_name);
      if (data) setWikiData(data);
    } catch (e) {
      console.warn("Wiki fetch failed", e);
    } finally {
      setLoadingWiki(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🧬 Encyclopedia</Text>
          <Text style={styles.headerSub}>Curated biological taxonomy database</Text>
        </View>
      </View>

      {/* SEARCH & FILTERS */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={[styles.searchRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            placeholder="Search scientific or common names..."
            placeholderTextColor={colors.textMuted}
          />
          {search ? (
            <TouchableOpacity onPress={() => { setSearch(""); loadSpecies(""); }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {CLASSES.map((cls) => (
            <TouchableOpacity
              key={cls}
              style={[styles.chip, activeClass === cls && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => setActiveClass(cls)}
            >
              <Text style={[styles.chipText, { color: activeClass === cls ? "#fff" : colors.textSecondary }]}>{cls}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* SPECIES GRID */}
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={species}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.bgCard }]}
              onPress={() => openDetails(item)}
            >
              <Image source={{ uri: item.image || item.imageUrl || "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=300" }} style={styles.cardImg} />
              <View style={styles.cardInfo}>
                <Text style={[styles.commonName, { color: colors.textPrimary }]} numberOfLines={1}>{item.common_name || item.scientific_name}</Text>
                <Text style={styles.latinName} numberOfLines={1}>{item.scientific_name}</Text>
                <View style={[styles.classBadge, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={[styles.classText, { color: colors.primary }]}>{item.class_name}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 10 }}>No matching species found</Text>
            </View>
          }
        />
      )}

      {/* DETAIL MODAL */}
      <Modal visible={!!selectedSpecies} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Species Details</Text>
              <TouchableOpacity onPress={() => setSelectedSpecies(null)}><Ionicons name="close" size={24} color={colors.textPrimary} /></TouchableOpacity>
            </View>

            {selectedSpecies && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image source={{ uri: wikiData?.thumbnail || selectedSpecies.image || selectedSpecies.imageUrl || "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=600" }} style={styles.modalImg} />

                <View style={styles.modalBody}>
                  <Text style={[styles.modalCommonName, { color: colors.textPrimary }]}>{selectedSpecies.common_name || selectedSpecies.scientific_name}</Text>
                  <Text style={styles.modalLatinName}>{selectedSpecies.scientific_name}</Text>

                  <View style={styles.modalMetaGrid}>
                    <View style={styles.metaBox}>
                      <Text style={styles.metaLab}>Kingdom</Text>
                      <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{selectedSpecies.kingdom || "Animalia"}</Text>
                    </View>
                    <View style={styles.metaBox}>
                      <Text style={styles.metaLab}>Phylum</Text>
                      <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{selectedSpecies.phylum || "Chordata"}</Text>
                    </View>
                    <View style={styles.metaBox}>
                      <Text style={styles.metaLab}>Class</Text>
                      <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{selectedSpecies.class_name}</Text>
                    </View>
                    <View style={styles.metaBox}>
                      <Text style={styles.metaLab}>Order</Text>
                      <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{selectedSpecies.order || "TBD"}</Text>
                    </View>
                  </View>

                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Description</Text>
                  {loadingWiki ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />
                  ) : (
                    <Text style={[styles.descText, { color: colors.textSecondary }]}>
                      {wikiData?.extract || selectedSpecies.description || "Authentic biological taxonomy record in EcoTrack Encyclopedia."}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[styles.trainBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      const name = selectedSpecies.common_name || selectedSpecies.scientific_name;
                      setSelectedSpecies(null);
                      router.push({ pathname: "/training", params: { species: name } });
                    }}
                  >
                    <Ionicons name="school" size={20} color="#fff" />
                    <Text style={styles.trainBtnText}>Generate Training Plan</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: "900" },
  headerSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  searchRow: { flexDirection: "row", alignItems: "center", borderRadius: Radius.lg, paddingHorizontal: 14, height: 46, borderWidth: 1, marginBottom: 12, ...Shadow.sm },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: "600" },

  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: "#e2e8f0", marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: "800" },

  grid: { padding: 12 },
  card: { width: (width - 36) / 2, borderRadius: 20, marginBottom: 12, marginRight: 12, overflow: "hidden", ...Shadow.sm },
  cardImg: { width: "100%", height: 120 },
  cardInfo: { padding: 12 },
  commonName: { fontWeight: "900", fontSize: 14 },
  latinName: { color: "#64748b", fontSize: 11, fontStyle: "italic", marginTop: 2 },
  classBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 8 },
  classText: { fontSize: 9, fontWeight: "900", textTransform: "uppercase" },

  empty: { height: 300, justifyContent: "center", alignItems: "center", width: width - 24 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: "90%", minHeight: "60%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  modalTitle: { fontSize: 18, fontWeight: "900" },
  modalImg: { width: "100%", height: 240 },
  modalBody: { padding: 24 },
  modalCommonName: { fontSize: 24, fontWeight: "900" },
  modalLatinName: { fontSize: 16, color: "#10b981", fontStyle: "italic", marginTop: 4, fontWeight: "700" },

  modalMetaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20, marginBottom: 24 },
  metaBox: { width: (width - 68) / 2, padding: 12, backgroundColor: "rgba(0,0,0,0.03)", borderRadius: 12 },
  metaLab: { fontSize: 9, color: "#64748b", fontWeight: "800", textTransform: "uppercase" },
  metaVal: { fontSize: 14, fontWeight: "700", marginTop: 2 },

  sectionHeading: { fontSize: 16, fontWeight: "900", marginBottom: 10 },
  descText: { fontSize: 14, lineHeight: 22, fontWeight: "500" },

  trainBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 16, marginTop: 30, ...Shadow.md },
  trainBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 }
});
