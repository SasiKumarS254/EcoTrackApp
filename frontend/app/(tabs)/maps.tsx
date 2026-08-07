import React, { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, Linking, Platform,
} from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { fetchCareServices } from "../../services/api";

type ServiceType = {
  id: number;
  name: string;
  type: string;
  location: string;
  distance: string;
  rating: string;
  reviews: number;
  phone: string;
  emergency: boolean;
  open24h: boolean;
  specialties: string[];
  icon: string;
  color: string;
};

const HOSPITALS: ServiceType[] = [
  { id: 1, name: "Blue Cross of India (Animal Rescue & Hospital)", type: "24x7 Emergency & Trauma", location: "Velachery Road, Guindy, Chennai", distance: "1.2 km", rating: "4.9", reviews: 1240, phone: "+914422354959", emergency: true, open24h: true, specialties: ["24x7 Ambulance", "Emergency Trauma", "Stray Rescue", "Surgeries"], icon: "medkit", color: "#ef4444" },
  { id: 2, name: "Madras Veterinary College Hospital (Government)", type: "Multi-Specialty Teaching Hospital", location: "Vepery, Chennai", distance: "2.5 km", rating: "4.8", reviews: 890, phone: "+914425304000", emergency: true, open24h: true, specialties: ["Advanced Radiology", "ICU Unit", "Orthopedics", "Exotic Care"], icon: "shield", color: "#10b981" },
  { id: 3, name: "SPCA Animal Hospital & Shelter", type: "Shelter & Clinical Inpatient", location: "Vepery High Road, Chennai", distance: "3.1 km", rating: "4.7", reviews: 430, phone: "+914425612894", emergency: false, open24h: false, specialties: ["Inpatient Care", "Spay/Neuter (ABC)", "Vaccination"], icon: "pulse", color: "#0ea5e9" },
  { id: 4, name: "CUPA Wildlife & Pet Trauma Center", type: "Wildlife Rescue & Emergency", location: "Kengeri, Bengaluru", distance: "4.8 km", rating: "4.8", reviews: 670, phone: "+918022947352", emergency: true, open24h: true, specialties: ["Avian & Reptile Rehab", "Monkey Rescue", "Trauma ICU"], icon: "shield", color: "#f59e0b" },
];

const PETSHOPS: ServiceType[] = [
  { id: 5, name: "Happy Pets World & Supplies", type: "Pet Food & Accessories", location: "OMR Road, Chennai", distance: "1.8 km", rating: "4.8", reviews: 267, phone: "+919840122334", emergency: false, open24h: false, specialties: ["Prescription Food", "Grooming Supplies", "Bedding & Toys"], icon: "bag", color: "#16a34a" },
  { id: 6, name: "Animal Kingdom Store", type: "Full-Service Pet Supplies", location: "Velachery, Chennai", distance: "3.2 km", rating: "4.6", reviews: 143, phone: "+919840277889", emergency: false, open24h: false, specialties: ["Aquarium Supplies", "Bird Cages", "Medicines"], icon: "storefront", color: "#8b5cf6" },
];

const GROOMING: ServiceType[] = [
  { id: 7, name: "Pawsome Grooming & Hygiene Spa", type: "Premium Grooming & Spa", location: "Nungambakkam, Chennai", distance: "2.4 km", rating: "4.9", reviews: 312, phone: "+919840122334", emergency: false, open24h: false, specialties: ["Medicated Bath", "Breed Haircut", "Nail Trimming", "Ear Hygiene"], icon: "cut", color: "#f59e0b" },
  { id: 8, name: "AquaVet Marine & Exotic Pet Care", type: "Exotic & Aquatic Pet Care", location: "ECR, Thiruvanmiyur, Chennai", distance: "5.2 km", rating: "4.7", reviews: 195, phone: "+914424418899", emergency: false, open24h: false, specialties: ["Aquarium Care", "Turtle Shell Repair", "Exotic Birds"], icon: "water", color: "#06b6d4" },
];

const DOCTORS = [
  { id: 1, name: "Dr. Ananya Krishnan", specialization: "Small Animal Surgery", hospital: "Pet Care Veterinary", experience: "12 years", rating: "4.9", available: true, fee: "₹800", image: "https://randomuser.me/api/portraits/women/45.jpg", userId: "usr_user1" },
  { id: 2, name: "Dr. Rajesh Kumar", specialization: "Wildlife Medicine", hospital: "Animal Rescue Center", experience: "8 years", rating: "4.8", available: false, fee: "₹650", image: "https://randomuser.me/api/portraits/men/32.jpg", userId: "usr_user2" },
  { id: 3, name: "Dr. Priya Sharma", specialization: "Veterinary Dermatology", hospital: "VetPro Clinic", experience: "6 years", rating: "4.7", available: true, fee: "₹700", image: "https://randomuser.me/api/portraits/women/68.jpg", userId: "usr1" },
  { id: 4, name: "Dr. Mohammed Ali", specialization: "Avian & Exotic Animals", hospital: "Pet Care Veterinary", experience: "10 years", rating: "4.9", available: true, fee: "₹900", image: "https://randomuser.me/api/portraits/men/55.jpg", userId: "usr_user3" },
];

const TABS = [
  { key: "hospitals", label: "🏥 Hospitals", data: HOSPITALS },
  { key: "petshops", label: "🐾 Pet Shops", data: PETSHOPS },
  { key: "grooming", label: "✂️ Grooming", data: GROOMING },
  { key: "doctors", label: "👨‍⚕️ Doctors", data: [] },
];

export default function MapsScreen() {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [activeTab, setActiveTab] = useState("hospitals");
  const [search, setSearch] = useState("");
  const [bookingModal, setBookingModal] = useState<ServiceType | any | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [animalType, setAnimalType] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [urgency, setUrgency] = useState("Routine");

  const [hospitalsList, setHospitalsList] = useState<ServiceType[]>(HOSPITALS);
  const [petshopsList, setPetshopsList] = useState<ServiceType[]>(PETSHOPS);
  const [groomingList, setGroomingList] = useState<ServiceType[]>(GROOMING);

  useEffect(() => {
    (async () => {
      const data = await fetchCareServices();
      if (data && Array.isArray(data) && data.length > 0) {
        const formatted: ServiceType[] = data.map((s: any) => ({
          id: s.id,
          name: s.name,
          type: s.category || s.type,
          location: s.address || `${s.city || 'Chennai'}`,
          distance: s.distance || "1.5 km",
          rating: String(s.rating || "4.8"),
          reviews: s.reviews || 100,
          phone: s.phone ? s.phone.replace(/\s+/g, '') : "+914422354959",
          emergency: Boolean(s.emergency),
          open24h: Boolean(s.open24h),
          specialties: s.specialties || ["Care Service"],
          icon: s.emoji === "🚨" ? "shield" : s.emoji === "✂️" ? "cut" : s.emoji === "🐠" ? "water" : "medkit",
          color: s.color || "#10b981"
        }));

        const hosp = formatted.filter(s => s.emergency || s.type.includes("Hospital") || s.type.includes("Emergency") || s.type.includes("Veterinary"));
        const shop = formatted.filter(s => s.type.includes("Shop") || s.type.includes("Supplies") || s.type.includes("Store"));
        const groom = formatted.filter(s => s.type.includes("Grooming") || s.type.includes("Spa") || s.type.includes("Marine") || s.type.includes("Exotic"));

        if (hosp.length > 0) setHospitalsList(hosp);
        if (shop.length > 0) setPetshopsList(shop);
        if (groom.length > 0) setGroomingList(groom);
      }
    })();
  }, []);

  const openDirections = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Navigation Error", "Could not open Google Maps application.");
    });
  };

  const getLiveStatus = (service: ServiceType) => {
    const now = new Date();
    const hour = now.getHours();

    if (service.open24h) return { label: "Open 24/7", color: colors.success };
    if (hour >= 9 && hour < 18) return { label: "Open Now", color: colors.success };
    if (hour >= 18 && hour < 20) return { label: "Closing Soon", color: colors.warning };
    return { label: "Closed", color: colors.danger };
  };

  const getTabData = () => {
    const map: Record<string, ServiceType[]> = { hospitals: hospitalsList, petshops: petshopsList, grooming: groomingList };
    const list = map[activeTab] || [];
    if (!search) return list;
    return list.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.location.toLowerCase().includes(search.toLowerCase()));
  };

  const isValidPhoneNumber = (phoneStr: string) => {
    if (!phoneStr) return false;
    const digits = phoneStr.replace(/[\s\-\(\)\+]/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      return /^\d{10}$/.test(digits.slice(2));
    }
    return /^\d{10}$/.test(digits);
  };

  const confirmBooking = (item: any) => {
    if (!ownerName.trim()) {
      Alert.alert("Missing Field", "Please enter Name of the Owner");
      return;
    }

    if (!isValidPhoneNumber(bookingPhone)) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit phone number");
      return;
    }

    if (!bookingDate.trim()) {
      Alert.alert("Missing Field", "Please select a preferred appointment date");
      return;
    }

    if (!bookingTime.trim()) {
      Alert.alert("Missing Field", "Please select a preferred time slot");
      return;
    }

    Alert.alert(
      "✅ Booking Confirmed",
      `Your ${urgency.toLowerCase()} appointment with ${item.name} is scheduled for ${bookingDate} at ${bookingTime}.\nOwner: ${ownerName}\nContact Phone: ${bookingPhone}\n\nConfirmation ID: ECO-${Math.floor(1000 + Math.random() * 9000)}`,
      [{ text: "Great", onPress: () => {
        setBookingModal(null);
        setOwnerName("");
        setBookingDate("");
        setBookingTime("");
        setBookingPhone("");
        setBookingNote("");
        setAnimalType("");
        setUrgency("Routine");
      }}]
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgLight} />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🗺️ Animal Services</Text>
          <Text style={styles.headerSub}>Find hospitals, shops & vets near you</Text>
        </View>

        {/* Emergency CTA */}
        <TouchableOpacity style={styles.emergencyBanner} onPress={() => Alert.alert("🚨 Emergency Hotline", "Connecting to nearest emergency vet...\n\nCall: +91-1962 (Animal Helpline)")} activeOpacity={0.9}>
          <View style={styles.emergencyLeft}>
            <View style={styles.emergencyIcon}><Ionicons name="warning" size={24} color="#fff" /></View>
            <View style={{ marginLeft: 14 }}>
              <Text style={styles.emergencyTitle}>Animal Emergency?</Text>
              <Text style={styles.emergencySubtitle}>Tap to call emergency helpline</Text>
            </View>
          </View>
          <View style={styles.callIcon}><Ionicons name="call" size={20} color={colors.danger} /></View>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.quickRow}>
          {[
            { label: "Emergency", icon: "medical", color: colors.danger, action: () => Linking.openURL("tel:+919876543210") },
            { label: "Book Doctor", icon: "calendar", color: colors.secondary, action: () => setActiveTab("doctors") },
            { label: "Directions", icon: "navigate", color: colors.primary, action: () => Alert.alert("Maps", "Opening Google Maps...") },
            { label: "Share Location", icon: "location", color: colors.warning, action: () => Alert.alert("Location", "Sharing your location with the clinic...") },
          ].map((q) => (
            <TouchableOpacity key={q.label} style={styles.quickCard} onPress={q.action} activeOpacity={0.85}>
              <View style={[styles.quickIcon, { backgroundColor: q.color + "18" }]}><Ionicons name={q.icon as any} size={22} color={q.color} /></View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput placeholder="Search services, hospitals..." placeholderTextColor={colors.textMuted} style={styles.searchInput} value={search} onChangeText={setSearch} />
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.key} style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]} onPress={() => setActiveTab(t.key)}>
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Service Cards */}
        {activeTab !== "doctors" && getTabData().map((item) => (
          <View key={item.id} style={styles.serviceCard}>
            <View style={styles.serviceTop}>
              <View style={[styles.serviceIcon, { backgroundColor: item.color + "18" }]}><Ionicons name={item.icon as any} size={26} color={item.color} /></View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{item.name}</Text>
                <Text style={styles.serviceType}>{item.type}</Text>
                <View style={styles.serviceMeta}>
                  <View style={styles.metaChip}><Ionicons name="location" size={11} color={colors.textMuted} /><Text style={styles.metaText}>{item.location}</Text></View>
                  <View style={styles.metaChip}><Ionicons name="navigate" size={11} color={colors.textMuted} /><Text style={styles.metaText}>{item.distance}</Text></View>
                  <View style={[styles.metaChip, { backgroundColor: getLiveStatus(item).color + '18' }]}><Text style={[styles.metaText, { color: getLiveStatus(item).color }]}>{getLiveStatus(item).label}</Text></View>
                </View>
              </View>
              <View style={styles.ratingBlock}>
                <Text style={styles.ratingValue}>{item.rating}</Text>
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text style={styles.ratingCount}>{item.reviews}</Text>
              </View>
            </View>

            {/* Badges */}
            <View style={styles.badgeRow}>
              {item.emergency && <View style={[styles.badge, { backgroundColor: "#fee2e2" }]}><Ionicons name="warning" size={11} color={colors.danger} /><Text style={[styles.badgeText, { color: colors.danger }]}>Emergency</Text></View>}
              {item.open24h && <View style={[styles.badge, { backgroundColor: "#dcfce7" }]}><Ionicons name="time" size={11} color={colors.success} /><Text style={[styles.badgeText, { color: colors.success }]}>Open 24/7</Text></View>}
              {item.specialties.slice(0, 2).map((s) => (
                <View key={s} style={styles.badge}><Text style={styles.badgeText}>{s}</Text></View>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                <Ionicons name="call" size={16} color="#fff" />
                <Text style={styles.callBtnText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dirBtn} onPress={() => openDirections(item.location)}>
                <Ionicons name="navigate" size={16} color={colors.secondary} />
                <Text style={styles.dirBtnText}>Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bookBtn} onPress={() => setBookingModal(item)}>
                <Ionicons name="calendar" size={16} color={colors.primary} />
                <Text style={styles.bookBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Doctors Tab */}
        {activeTab === "doctors" && (
          <>
            <Text style={styles.doctorSectionTitle}>Available Veterinarians</Text>
            {DOCTORS.map((doc) => (
              <View key={doc.id} style={styles.doctorCard}>
                <View style={styles.doctorTop}>
                  <View style={styles.doctorAvatarWrapper}>
                    <Text style={{ fontSize: 36 }}>{doc.available ? "👨‍⚕️" : "👩‍⚕️"}</Text>
                    <View style={[styles.availDot, { backgroundColor: doc.available ? colors.success : colors.textMuted }]} />
                  </View>
                  <View style={styles.doctorInfo}>
                    <Text style={styles.doctorName}>{doc.name}</Text>
                    <Text style={styles.doctorSpec}>{doc.specialization}</Text>
                    <Text style={styles.doctorHospital}>{doc.hospital}</Text>
                    <View style={styles.doctorMeta}>
                      <View style={styles.metaChip}><Ionicons name="briefcase" size={11} color={colors.textMuted} /><Text style={styles.metaText}>{doc.experience}</Text></View>
                      <View style={styles.metaChip}><Ionicons name="star" size={11} color="#f59e0b" /><Text style={styles.metaText}>{doc.rating}</Text></View>
                    </View>
                  </View>
                  <View style={styles.doctorFee}>
                    <Text style={styles.feeLabel}>Fee</Text>
                    <Text style={styles.feeValue}>{doc.fee}</Text>
                    <Text style={[styles.availLabel, { color: doc.available ? colors.success : colors.textMuted }]}>{doc.available ? "Available" : "Booked"}</Text>
                  </View>
                </View>
                <View style={styles.doctorBtns}>
                  <TouchableOpacity
                    style={[styles.appointmentBtn, !doc.available && styles.appointmentBtnDisabled]}
                    disabled={!doc.available}
                    onPress={() => setBookingModal(doc)}
                  >
                    <Ionicons name="calendar" size={16} color="#fff" />
                    <Text style={styles.appointmentBtnText}>{doc.available ? "Book Appointment" : "Fully Booked"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.chatDoctorBtn} onPress={() => router.push(`/chat/${doc.userId || doc.id}?name=${encodeURIComponent(doc.name)}`)}>
                    <Ionicons name="chatbubble" size={16} color={colors.secondary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Booking Modal inline overlay */}
        {bookingModal && (
          <View style={styles.bookingOverlay}>
            <View style={styles.bookingSheet}>
              <View style={styles.bookingHandle} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.bookingTitle}>📅 Book Appointment</Text>
                <TouchableOpacity onPress={() => setBookingModal(null)}><Ionicons name="close-circle" size={24} color={colors.textMuted} /></TouchableOpacity>
              </View>
              <Text style={styles.bookingHospital}>{bookingModal.name}</Text>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450 }}>
                <Text style={styles.bookingLabel}>Name of the Owner *</Text>
                <TextInput
                  style={styles.bookingInput}
                  value={ownerName}
                  onChangeText={setOwnerName}
                  placeholder="e.g. Alex Morgan"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.bookingLabel}>Contact Phone Number *</Text>
                <TextInput
                  style={styles.bookingInput}
                  value={bookingPhone}
                  onChangeText={setBookingPhone}
                  placeholder="e.g. +91 98765 43210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                />

                <Text style={styles.bookingLabel}>Pet Name (Optional)</Text>
                <TextInput
                  style={styles.bookingInput}
                  value={animalType}
                  onChangeText={setAnimalType}
                  placeholder="e.g. Max (German Shepherd)"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.bookingLabel}>Urgency Level</Text>
                <View style={styles.timePicker}>
                  {["Routine", "Urgent", "Emergency"].map((u) => (
                    <TouchableOpacity key={u} style={[styles.timeSlot, urgency === u && { backgroundColor: u === 'Emergency' ? colors.danger : colors.primary, borderColor: u === 'Emergency' ? colors.danger : colors.primary }]} onPress={() => setUrgency(u)}>
                      <Text style={[styles.timeSlotText, urgency === u && { color: '#fff' }]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.bookingLabel}>Preferred Date</Text>
                <TextInput style={styles.bookingInput} value={bookingDate} onChangeText={setBookingDate} placeholder="e.g. 15 June 2026" placeholderTextColor={colors.textMuted} />

                <Text style={styles.bookingLabel}>Preferred Time</Text>
                <View style={styles.timePicker}>
                  {["9:00 AM", "11:00 AM", "2:00 PM", "4:00 PM", "6:00 PM"].map((t) => (
                    <TouchableOpacity key={t} style={[styles.timeSlot, bookingTime === t && styles.timeSlotActive]} onPress={() => setBookingTime(t)}>
                      <Text style={[styles.timeSlotText, bookingTime === t && styles.timeSlotTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.bookingLabel}>Condition Notes</Text>
                <TextInput style={[styles.bookingInput, { height: 80 }]} value={bookingNote} onChangeText={setBookingNote} placeholder="Describe symptoms or reason for visit..." placeholderTextColor={colors.textMuted} multiline />

                <View style={styles.bookingBtns}>
                  <TouchableOpacity style={styles.cancelBookingBtn} onPress={() => setBookingModal(null)}><Text style={styles.cancelBookingText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBookingBtn} onPress={() => confirmBooking(bookingModal)}><Text style={styles.confirmBookingText}>Confirm Booking</Text></TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgLight },
    scroll: { flex: 1 },
    header: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 10 },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: "800", color: colors.textPrimary },
    headerSub: { fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 2 },

    emergencyBanner: { marginHorizontal: 16, marginTop: 12, backgroundColor: isDark ? "#450a0a" : "#fff1f2", borderRadius: Radius.xl, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1.5, borderColor: isDark ? "#7f1d1d" : "#fecdd3" },
    emergencyLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    emergencyIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.danger, justifyContent: "center", alignItems: "center" },
    emergencyTitle: { fontSize: FontSize.lg, fontWeight: "800", color: colors.danger },
    emergencySubtitle: { fontSize: FontSize.sm, color: isDark ? "#f87171" : "#f87171", marginTop: 2 },
    callIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: isDark ? "#7f1d1d" : "#ffe4e6", justifyContent: "center", alignItems: "center" },

    quickRow: { flexDirection: "row", paddingHorizontal: 12, marginTop: 16, gap: 8 },
    quickCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: Radius.lg, padding: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border, ...Shadow.sm },
    quickIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    quickLabel: { fontSize: 10, fontWeight: "700", color: colors.textPrimary, marginTop: 8, textAlign: "center" },

    searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: Radius.lg, marginHorizontal: 16, marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, ...Shadow.sm },
    searchInput: { flex: 1, marginLeft: 10, fontSize: FontSize.md, color: colors.textPrimary },

    tabRow: { marginTop: 14 },
    tabBtn: { backgroundColor: isDark ? "#1e293b" : "#f3f4f6", borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
    tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: "600" },
    tabTextActive: { color: "#fff", fontWeight: "700" },

    serviceCard: { marginHorizontal: 16, marginTop: 14, backgroundColor: colors.bgCard, borderRadius: Radius.xl, padding: 18, borderWidth: 1, borderColor: colors.border, ...Shadow.md },
    serviceTop: { flexDirection: "row", alignItems: "flex-start" },
    serviceIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
    serviceInfo: { flex: 1, marginLeft: 14 },
    serviceName: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary },
    serviceType: { fontSize: FontSize.sm, color: colors.primary, fontWeight: "600", marginTop: 2 },
    serviceMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
    metaChip: { flexDirection: "row", alignItems: "center", backgroundColor: isDark ? "#0f172a" : "#f3f4f6", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
    metaText: { fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: "600" },
    ratingBlock: { alignItems: "center", minWidth: 44 },
    ratingValue: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary },
    ratingCount: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },

    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
    badge: { flexDirection: "row", alignItems: "center", backgroundColor: isDark ? "#0f172a" : "#f3f4f6", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
    badgeText: { fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: "700" },

    actionRow: { flexDirection: "row", marginTop: 16, gap: 10 },
    callBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.success, borderRadius: Radius.md, paddingVertical: 12, gap: 6 },
    callBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
    dirBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.secondary, borderRadius: Radius.md, paddingVertical: 12, gap: 6 },
    dirBtnText: { color: colors.secondary, fontWeight: "700", fontSize: FontSize.sm },
    bookBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.primary, borderRadius: Radius.md, paddingVertical: 12, gap: 6 },
    bookBtnText: { color: colors.primary, fontWeight: "700", fontSize: FontSize.sm },

    doctorSectionTitle: { fontSize: FontSize.xl, fontWeight: "800", color: colors.textPrimary, marginHorizontal: 20, marginTop: 16 },
    doctorCard: { marginHorizontal: 16, marginTop: 14, backgroundColor: colors.bgCard, borderRadius: Radius.xl, padding: 18, borderWidth: 1, borderColor: colors.border, ...Shadow.md },
    doctorTop: { flexDirection: "row", alignItems: "flex-start" },
    doctorAvatarWrapper: { position: "relative" },
    availDot: { position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: isDark ? colors.bgCard : "#fff" },
    doctorInfo: { flex: 1, marginLeft: 14 },
    doctorName: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary },
    doctorSpec: { fontSize: FontSize.sm, color: colors.primary, fontWeight: "700", marginTop: 2 },
    doctorHospital: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    doctorMeta: { flexDirection: "row", gap: 8, marginTop: 8 },
    doctorFee: { alignItems: "flex-end" },
    feeLabel: { fontSize: FontSize.xs, color: colors.textMuted, fontWeight: "600" },
    feeValue: { fontSize: FontSize.lg, fontWeight: "800", color: colors.primary },
    availLabel: { fontSize: FontSize.xs, fontWeight: "700", marginTop: 2 },
    doctorBtns: { flexDirection: "row", marginTop: 16, gap: 10 },
    appointmentBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 12, gap: 8 },
    appointmentBtnDisabled: { backgroundColor: isDark ? "#334155" : "#d1d5db" },
    appointmentBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
    chatDoctorBtn: { width: 48, height: 48, borderRadius: Radius.md, borderWidth: 1.5, borderColor: colors.secondary, justifyContent: "center", alignItems: "center" },

    bookingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", zIndex: 999 },
    bookingSheet: { backgroundColor: colors.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
    bookingHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
    bookingTitle: { fontSize: FontSize.xl, fontWeight: "800", color: colors.textPrimary },
    bookingHospital: { fontSize: FontSize.md, color: colors.primary, fontWeight: "600", marginTop: 4, marginBottom: 20 },
    bookingLabel: { fontSize: FontSize.sm, fontWeight: "700", color: colors.textPrimary, marginBottom: 8, marginTop: 12 },
    bookingInput: { backgroundColor: isDark ? "#0f172a" : "#f9fafb", borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSize.md, color: colors.textPrimary },
    timePicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
    timeSlot: { backgroundColor: isDark ? "#0f172a" : "#f3f4f6", borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.border },
    timeSlotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    timeSlotText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: "600" },
    timeSlotTextActive: { color: "#fff", fontWeight: "700" },
    bookingBtns: { flexDirection: "row", marginTop: 20, gap: 12 },
    cancelBookingBtn: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center" },
    cancelBookingText: { fontSize: FontSize.md, color: colors.textSecondary, fontWeight: "700" },
    confirmBookingBtn: { flex: 2, backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center" },
    confirmBookingText: { fontSize: FontSize.md, color: "#fff", fontWeight: "800" },
  });
}
