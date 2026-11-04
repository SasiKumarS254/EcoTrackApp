import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, Linking, Modal, Dimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { fetchCareServices, API_BASE_URL } from "../../services/api";



const BASE_SERVICES = [
  {
    id: 1,
    name: "Blue Cross Animal Rescue & Emergency Hospital",
    type: "Emergency",
    category: "Shelter & 24×7 Hospital",
    distance: "1.2 km",
    rating: "4.9",
    reviews: 1240,
    phone: "+914422354959",
    address: "72 Velachery Rd, Guindy, Chennai",
    emergency: true,
    open24h: true,
    specialties: ["24x7 Ambulance", "Trauma Surgery", "Wildlife Rescue"],
    icon: "shield",
    color: "#ef4444",
  },
  {
    id: 2,
    name: "Madras Veterinary College Hospital",
    type: "Veterinary",
    category: "Multi-Specialty Teaching Hospital",
    distance: "2.5 km",
    rating: "4.8",
    reviews: 890,
    phone: "+914425304000",
    address: "High Road, Vepery, Chennai",
    emergency: true,
    open24h: true,
    specialties: ["Advanced Radiology", "ICU Care", "Exotic Animals"],
    icon: "medkit",
    color: "#10b981",
  },
  {
    id: 6,
    name: "Happy Paws Grooming & Pet Hygiene Spa",
    type: "Grooming",
    category: "Grooming & Hygiene Spa",
    distance: "1.8 km",
    rating: "4.9",
    reviews: 310,
    phone: "+919840122334",
    address: "124 OMR Road, Kandanchavadi, Chennai",
    emergency: false,
    open24h: false,
    specialties: ["Medicated Flea Baths", "Coat Styling", "Nail Clipping"],
    icon: "cut",
    color: "#8b5cf6",
  },
  {
    id: 4,
    name: "SPCA Animal Hospital & Shelter",
    type: "Shelter",
    category: "Shelter & Care Clinic",
    distance: "3.1 km",
    rating: "4.7",
    reviews: 430,
    phone: "+914425612894",
    address: "5 Vepery High Road, Chennai",
    emergency: false,
    open24h: false,
    specialties: ["Stray Inpatient Care", "Vaccination Drives", "Free Spay/Neuter"],
    icon: "home",
    color: "#3b82f6",
  },
  {
    id: 5,
    name: "CUPA Wildlife & Pet Trauma Sanctuary",
    type: "Rehab",
    category: "Wildlife Rescue & Rehab",
    distance: "4.8 km",
    rating: "4.8",
    reviews: 670,
    phone: "+918022947352",
    address: "Kengeri Sanctuary Zone, Bengaluru",
    emergency: true,
    open24h: true,
    specialties: ["Avian & Reptile Rehabilitation", "Stray Sanctuary", "Diagnostics"],
    icon: "leaf",
    color: "#f59e0b",
  },
  {
    id: 9,
    name: "EcoTrack Organics & Pet Nutrition Store",
    type: "Shop",
    category: "Organic Pet Supplies",
    distance: "1.5 km",
    rating: "4.8",
    reviews: 280,
    phone: "+919840311223",
    address: "88 Anna Nagar 2nd Avenue, Chennai",
    emergency: false,
    open24h: false,
    specialties: ["Holistic Pet Nutrition", "Eco Leashes", "Supplements"],
    icon: "paw",
    color: "#10b981",
  },
];

export default function MapsScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [services, setServices] = useState<any[]>(BASE_SERVICES);
  const [appointments, setAppointments] = useState<any[]>([]);

  // Booking Modal
  const [bookingFacility, setBookingFacility] = useState<any>(null);
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [petName, setPetName] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("Tomorrow, 10:30 AM");

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCareServices();
        if (data && Array.isArray(data) && data.length > 0) {
          const formatted = data.map((s: any) => ({
            id: s.id,
            name: s.name,
            type: s.type || s.category || "Veterinary",
            category: s.category || s.type,
            distance: s.distance || "2.0 km",
            rating: String(s.rating || "4.8"),
            reviews: s.reviews || 100,
            phone: s.phone ? s.phone.replace(/\s+/g, "") : "+914422354959",
            address: s.address || s.city || "Chennai, TN",
            emergency: Boolean(s.emergency),
            open24h: Boolean(s.open24h),
            specialties: s.specialties || ["Care Facility"],
            icon: s.emergency ? "shield" : s.type === "Grooming" ? "cut" : s.type === "Shelter" ? "home" : "medkit",
            color: s.color || "#10b981",
          }));
          const unique = Array.from(new Map(formatted.map((item: any) => [item.id || item.name, item])).values());
          setServices(unique);
        }
      } catch {
        console.warn("Using offline verified services list");
      }
    })();
  }, []);

  const openDirections = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open map navigation."));
  };

  const handleConfirmBooking = () => {
    if (!ownerName.trim() || !phone.trim()) {
      Alert.alert("Missing Fields", "Please enter owner name and contact phone number.");
      return;
    }

    const appt = {
      id: `APT-${Math.floor(1000 + Math.random() * 9000)}`,
      facilityName: bookingFacility.name,
      date: appointmentDate,
      owner: ownerName,
      pet: petName || "Animal Patient",
      phone,
      address: bookingFacility.address,
    };

    setAppointments([appt, ...appointments]);
    setBookingFacility(null);
    setOwnerName("");
    setPhone("");
    setPetName("");

    Alert.alert("Booking Confirmed ✅", `Appointment scheduled at ${appt.facilityName} for ${appt.date}.\nConfirmation: ${appt.id}`);
  };

  const handleCancelAppointment = (apptId: string, facilityName: string) => {
    Alert.alert(
      "Cancel Appointment",
      `Are you sure you want to cancel your scheduled appointment at ${facilityName}?`,
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Cancel Appointment",
          style: "destructive",
          onPress: () => {
            setAppointments((prev) => prev.filter((a) => a.id !== apptId));
            Alert.alert("Booking Cancelled ❌", `Your appointment at ${facilityName} has been cancelled.`);
          },
        },
      ]
    );
  };

  const categories = [
    { key: "All", label: "All Facilities" },
    { key: "Appointments", label: `📅 My Appointments (${appointments.length})` },
    { key: "Veterinary", label: "🏥 Vet Clinics" },
    { key: "Grooming", label: "✂️ Grooming" },
    { key: "Shelter", label: "🏠 Shelters" },
    { key: "Emergency", label: "🚨 24×7 Emergency" },
    { key: "Rehab", label: "🌿 Wildlife Rehab" },
  ];

  const displayedList = useMemo(() => {
    if (activeFilter === "Appointments") return [];
    let list = services;
    if (activeFilter !== "All") {
      if (activeFilter === "Emergency") {
        list = list.filter((s) => s.emergency);
      } else {
        list = list.filter(
          (s) =>
            s.type?.toLowerCase().includes(activeFilter.toLowerCase()) ||
            s.category?.toLowerCase().includes(activeFilter.toLowerCase())
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.address?.toLowerCase().includes(q) ||
          s.specialties?.some((spec: string) => spec.toLowerCase().includes(q))
      );
    }
    return list;
  }, [services, activeFilter, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.topIconWrap}>
            <Ionicons name="location" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.topTitle}>Find Animal Services</Text>
            <Text style={styles.topSub}>Hospitals, Clinics & ER Rescue</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={() => Alert.alert("Location Active 📍", "GPS calibrated to your nearest regional emergency perimeter.")}
          >
            <Ionicons name="navigate" size={14} color={colors.primary} />
            <Text style={styles.locationBtnText}>Near Me</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileHeaderBtn}
            onPress={() => router.push("/(tabs)/profile")}
            activeOpacity={0.8}
          >
            <Ionicons name="person-circle" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* HERO CARD */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
              <Text style={styles.heroBadgeText}>100% VERIFIED PARTNERS</Text>
            </View>
            <Text style={styles.heroTitle}>Animal Care Services Near You</Text>
            <Text style={styles.heroDesc}>
              Locate verified veterinary hospitals, shelters, and 24×7 emergency trauma facilities in your area.
            </Text>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clinic name, specialty, location..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* CATEGORY FILTER CHIPS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[styles.categoryChip, activeFilter === c.key && styles.categoryChipActive]}
              onPress={() => setActiveFilter(c.key)}
            >
              <Text style={[styles.categoryChipText, activeFilter === c.key && styles.categoryChipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* APPOINTMENTS VIEW */}
        {activeFilter === "Appointments" ? (
          <View style={styles.appointmentsWrap}>
            {appointments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Appointments Booked</Text>
                <Text style={styles.emptySub}>Select any veterinary hospital or groomer below to book a slot.</Text>
              </View>
            ) : (
              appointments.map((appt, idx) => (
                <View key={`appt-${appt.id || idx}-${idx}`} style={styles.appointmentCard}>
                  <View style={styles.appointmentHeader}>
                    <Text style={styles.apptFacilityTitle}>{appt.facilityName}</Text>
                    <View style={styles.apptBadge}>
                      <Text style={styles.apptBadgeText}>{appt.id}</Text>
                    </View>
                  </View>
                  <View style={styles.apptRow}>
                    <Ionicons name="time" size={14} color={colors.primary} />
                    <Text style={styles.apptValText}>Scheduled: {appt.date}</Text>
                  </View>
                  <View style={styles.apptRow}>
                    <Ionicons name="person" size={14} color={colors.textMuted} />
                    <Text style={styles.apptValText}>Owner: {appt.owner} (Pet: {appt.pet})</Text>
                  </View>
                  <View style={styles.apptRow}>
                    <Ionicons name="location" size={14} color={colors.textMuted} />
                    <Text style={styles.apptValText}>{appt.address}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.cancelApptBtn}
                    onPress={() => handleCancelAppointment(appt.id, appt.facilityName)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={15} color="#ef4444" />
                    <Text style={styles.cancelApptBtnText}>Cancel Booking</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        ) : (
          /* SERVICES CATALOG */
          <View style={styles.servicesGrid}>
            {displayedList.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="medical-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Facilities Found</Text>
                <Text style={styles.emptySub}>Try searching with different specialty terms or perimeters.</Text>
              </View>
            ) : (
              displayedList.map((item, index) => (
                <View key={`facility-${item.id ?? index}-${index}`} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={[styles.facilityIconCircle, { backgroundColor: item.color + "18" }]}>
                      <Ionicons name={item.icon as any} size={24} color={item.color} />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.facilityName}>{item.name}</Text>
                      <Text style={styles.facilityType}>{item.category}</Text>

                      <View style={styles.facilityMetaRow}>
                        <Ionicons name="location" size={11} color={colors.textMuted} />
                        <Text style={styles.facilityMetaText}>{item.distance}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Ionicons name="star" size={11} color="#f59e0b" />
                        <Text style={styles.facilityMetaText}>{item.rating} ({item.reviews})</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.facilityAddress} numberOfLines={2}>
                    {item.address}
                  </Text>

                  {/* Specialties Pills */}
                  <View style={styles.specialtiesRow}>
                    {item.emergency && (
                      <View style={[styles.specPill, { backgroundColor: "#fee2e2" }]}>
                        <Text style={[styles.specPillText, { color: colors.danger }]}>24×7 ER</Text>
                      </View>
                    )}
                    {item.specialties?.slice(0, 2).map((s: string, idx: number) => (
                      <View key={`spec-${item.id}-${idx}`} style={styles.specPill}>
                        <Text style={styles.specPillText}>{s}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => Linking.openURL(`tel:${item.phone}`)}
                    >
                      <Ionicons name="call" size={14} color="#fff" />
                      <Text style={styles.callBtnText}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dirBtn}
                      onPress={() => openDirections(item.address)}
                    >
                      <Ionicons name="navigate" size={14} color={colors.secondary} />
                      <Text style={styles.dirBtnText}>Directions</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.bookBtn}
                      onPress={() => setBookingFacility(item)}
                    >
                      <Ionicons name="calendar" size={14} color={colors.primary} />
                      <Text style={styles.bookBtnText}>Book Slot</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* APPOINTMENT BOOKING MODAL */}
      <Modal visible={Boolean(bookingFacility)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.bookingSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.bookingBadge}>APPOINTMENT RESERVATION</Text>
                <Text style={styles.bookingTitle}>{bookingFacility?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setBookingFacility(null)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Name of Owner *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Alex Morgan"
                placeholderTextColor={colors.textMuted}
                value={ownerName}
                onChangeText={setOwnerName}
              />

              <Text style={styles.inputLabel}>Contact Phone *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Pet / Animal Name & Breed (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Max (German Shepherd)"
                placeholderTextColor={colors.textMuted}
                value={petName}
                onChangeText={setPetName}
              />

              <Text style={styles.inputLabel}>Preferred Date & Time Slot</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Tomorrow, 10:30 AM"
                placeholderTextColor={colors.textMuted}
                value={appointmentDate}
                onChangeText={setAppointmentDate}
              />

              <TouchableOpacity style={styles.submitBookingBtn} onPress={handleConfirmBooking}>
                <Ionicons name="calendar-outline" size={16} color="#fff" />
                <Text style={styles.submitBookingBtnText}>Confirm Appointment</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgLight,
    },
    topHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingVertical: 14,
      backgroundColor: colors.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      maxWidth: 1000,
      width: "100%",
      alignSelf: "center",
    },
    profileHeaderBtn: {
      padding: 2,
    },
    topIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#10b981",
      justifyContent: "center",
      alignItems: "center",
    },
    topTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.textPrimary,
    },
    topSub: {
      fontSize: 10.5,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    locationBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.full,
      gap: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    locationBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.primary,
    },

    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      maxWidth: 1000,
      width: "100%",
      alignSelf: "center",
    },

    heroCard: {
      backgroundColor: isDark ? "#064e3b22" : "#f0fdf4",
      borderRadius: Radius.xl,
      padding: 18,
      borderWidth: 1,
      borderColor: isDark ? "#065f46" : "#bbf7d0",
      marginBottom: 14,
    },
    heroLeft: {},
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 4,
    },
    heroBadgeText: {
      fontSize: 9.5,
      fontWeight: "800",
      color: colors.primary,
      letterSpacing: 0.8,
    },
    heroTitle: {
      fontSize: FontSize.md,
      fontWeight: "900",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    heroDesc: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    searchBarWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bgCard,
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      gap: 10,
      ...Shadow.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: FontSize.sm,
      color: colors.textPrimary,
    },

    categoryScroll: {
      flexDirection: "row",
      marginBottom: 16,
    },
    categoryChip: {
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.full,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryChipText: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    categoryChipTextActive: {
      color: "#fff",
      fontWeight: "800",
    },

    servicesGrid: {
      gap: 14,
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.sm,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    facilityIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    facilityName: {
      fontSize: FontSize.md,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    facilityType: {
      fontSize: FontSize.xs,
      color: colors.primary,
      fontWeight: "700",
      marginBottom: 4,
    },
    facilityMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    facilityMetaText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "600",
    },
    metaDot: {
      color: colors.textMuted,
      marginHorizontal: 2,
    },
    facilityAddress: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 10,
    },
    specialtiesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 14,
    },
    specPill: {
      backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
    },
    specPillText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textSecondary,
    },

    cardActionsRow: {
      flexDirection: "row",
      gap: 8,
    },
    callBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 10,
      borderRadius: Radius.md,
      gap: 5,
    },
    callBtnText: {
      color: "#fff",
      fontSize: FontSize.xs,
      fontWeight: "800",
    },
    dirBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.secondary,
      paddingVertical: 10,
      borderRadius: Radius.md,
      gap: 5,
    },
    dirBtnText: {
      color: colors.secondary,
      fontSize: FontSize.xs,
      fontWeight: "800",
    },
    bookBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.primary,
      paddingVertical: 10,
      borderRadius: Radius.md,
      gap: 5,
    },
    bookBtnText: {
      color: colors.primary,
      fontSize: FontSize.xs,
      fontWeight: "800",
    },

    appointmentsWrap: {
      gap: 12,
    },
    appointmentCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    appointmentHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    apptFacilityTitle: {
      fontSize: FontSize.sm,
      fontWeight: "800",
      color: colors.textPrimary,
      flex: 1,
    },
    apptBadge: {
      backgroundColor: isDark ? "#064e3b" : "#dcfce7",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
    },
    apptBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.primary,
    },
    apptRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    apptValText: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    cancelApptBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: "rgba(239, 68, 68, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.3)",
      borderRadius: Radius.md,
      paddingVertical: 8,
      marginTop: 8,
    },
    cancelApptBtnText: {
      color: "#ef4444",
      fontSize: 12,
      fontWeight: "700",
    },

    emptyCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 36,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: {
      fontSize: FontSize.md,
      fontWeight: "800",
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 4,
    },
    emptySub: {
      fontSize: FontSize.xs,
      color: colors.textMuted,
      textAlign: "center",
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    bookingSheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 22,
      maxWidth: 640,
      width: "100%",
      maxHeight: "85%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    bookingBadge: {
      fontSize: 9,
      fontWeight: "800",
      color: colors.primary,
      letterSpacing: 1,
      marginBottom: 4,
    },
    bookingTitle: {
      fontSize: FontSize.md,
      fontWeight: "900",
      color: colors.textPrimary,
      maxWidth: 300,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    modalInput: {
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: FontSize.sm,
      color: colors.textPrimary,
      marginBottom: 12,
    },
    submitBookingBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: Radius.md,
      marginTop: 8,
      marginBottom: 10,
      gap: 6,
    },
    submitBookingBtnText: {
      color: "#fff",
      fontSize: FontSize.sm,
      fontWeight: "800",
    },
  });
}
