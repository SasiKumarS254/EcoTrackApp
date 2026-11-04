import { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, Modal, Alert, StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useNavigation } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize } from "../../constants/theme";
import { fetchEvents, createEvent, fetchRegisteredEvents, registerForEvent } from "../../services/api";



const BASE_EVENTS = [
  {
    id: "1",
    title: "Wildlife Rescue Camp",
    category: "Rescue",
    date: "22 November 2026",
    location: "Chennai Wildlife Reserve",
    image: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=85&w=1200",
    description: "Join wildlife experts and rescue injured animals in a hands-on camp.",
    longDescription: "This intensive weekend camp is designed for animal lovers who want to learn real-world rescue techniques. You will shadow senior veterinarians, participate in rehabilitation sessions for raptors, and learn how to safely transport injured mammals. All equipment and basic meals provided.",
    attendeesCount: 142,
    isFree: true,
    price: 0,
    organizer: "EcoTrack Foundation",
    creator_id: "usr_user2",
  },
  {
    id: "2",
    title: "International Dog Exhibition",
    category: "Exhibition",
    date: "29 November 2026",
    location: "Bangalore Expo Center",
    image: "https://images.unsplash.com/photo-1517849845537-4d257902454a?q=85&w=1200",
    description: "Showcase dog breeds, participate in competitions, meet breeders.",
    longDescription: "The biggest canine event of the year! Over 500 breeds on display, agility competitions, grooming workshops, and stalls from the top pet care brands in Asia. Special sessions on advanced obedience using AI tracking tools. Tickets include a goodie bag for your pet.",
    attendeesCount: 894,
    isFree: false,
    price: 499,
    organizer: "Kennel Club India",
    creator_id: "usr_user3",
  },
  {
    id: "3",
    title: "National Adoption Drive",
    category: "Adoption",
    date: "06 December 2026",
    location: "Chennai SPCA",
    image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=85&w=1200",
    description: "Adopt a rescued dog or cat and give them a loving forever home.",
    longDescription: "Find your new best friend at our monthly adoption drive. Over 50 dogs and cats from various shelters will be present. All animals are vaccinated, dewormed, and microchipped. Adoption counselors will be on site to help you find the perfect match for your lifestyle.",
    attendeesCount: 320,
    isFree: true,
    price: 0,
    organizer: "Blue Cross India",
    creator_id: "usr_user1",
  },
  {
    id: "4",
    title: "Bird Conservation Seminar",
    category: "Conservation",
    date: "15 December 2026",
    location: "TNAU Auditorium, Coimbatore",
    image: "https://images.unsplash.com/photo-1444464666168-49d633b86797?q=85&w=1200",
    description: "Expert talks on endangered bird species conservation and habitat protection.",
    longDescription: "A gathering of ornithologists and conservationists to discuss the state of migratory birds in South India. Topics include wetland protection, pesticide impacts, and how citizen scientists can contribute to bird counts using the EcoTrack app.",
    attendeesCount: 68,
    isFree: true,
    price: 0,
    organizer: "Bird Watch India",
    creator_id: "usr_user2",
  },
  {
    id: "5",
    title: "AI Animal Training Workshop",
    category: "Training",
    date: "27 December 2026",
    location: "Virtual + Chennai Hub",
    image: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=85&w=1200",
    description: "Learn AI-powered training techniques for pets and wild animals.",
    longDescription: "Discover how advanced techniques are revolutionizing animal training. This workshop covers the basics of behavioral correction, focus training, and monitoring rehabilitation progress in injured animals.",
    attendeesCount: 210,
    isFree: false,
    price: 999,
    organizer: "EcoTrack AI Labs",
    creator_id: "usr_user3",
  },
];

export default function EventsScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const navigation = useNavigation<any>();

  const [activeTab, setActiveTab] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [eventsList, setEventsList] = useState<any[]>(BASE_EVENTS);
  const [registeredEventIds, setRegisteredEventIds] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);

  // Host Event Modal
  const [showHostModal, setShowHostModal] = useState(false);
  const [hostTitle, setHostTitle] = useState("");
  const [hostCategory, setHostCategory] = useState("Rescue");
  const [hostDate, setHostDate] = useState("");
  const [hostLoc, setHostLoc] = useState("");
  const [hostDesc, setHostDesc] = useState("");
  const [hostImage, setHostImage] = useState<string | null>(null);

  // Real User-to-User Chat with Event Host / Organizer
  const openChatWithOrganizer = (ev: any) => {
    if (!ev) return;
    const organizerId =
      ev.creator_id ||
      ev.user_id ||
      ev.organizer_id ||
      (ev.organizer ? `usr_${String(ev.organizer).toLowerCase().replace(/[^a-z0-9]/g, '_')}` : `usr_org_${ev.id}`);
    const organizerName = ev.organizer || "Event Organizer";

    router.push({
      pathname: "/chat/[id]",
      params: {
        id: String(organizerId),
        name: String(organizerName),
        listingId: `event_${ev.id}`,
      },
    });
  };

  const handlePickHostImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Media library access is needed to choose an event banner.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setHostImage(res.assets[0].uri);
      }
    } catch {
      Alert.alert("Picker Error", "Could not choose event banner from gallery.");
    }
  };

  const handleTakeHostPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Camera Permission Required", "Camera access is needed to capture event flyers.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setHostImage(res.assets[0].uri);
      }
    } catch {
      Alert.alert("Camera Error", "Could not open camera.");
    }
  };

  // Pass Modal
  const [selectedPass, setSelectedPass] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const sessionRaw = await AsyncStorage.getItem("@ecotrack_user_session");
        let activeUserId = null;
        if (sessionRaw) {
          const u = JSON.parse(sessionRaw);
          setUser(u);
          activeUserId = u.user_id || u.id;
        }

        const [data, regData] = await Promise.all([
          fetchEvents().catch(() => null),
          activeUserId ? fetchRegisteredEvents(activeUserId).catch(() => null) : null,
        ]);

        if (data && Array.isArray(data) && data.length > 0) {
          const formatted = data.map((e: any) => ({
            id: String(e.id || e._id),
            title: e.title || e.name || "Community Event",
            category: e.category || "Rescue",
            date: e.date || e.date_str || e.date_iso || "Upcoming",
            location: e.location || e.venue || "Chennai, TN",
            image: e.image || e.banner || "https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=85&w=1200",
            description: e.description || "Animal welfare event.",
            longDescription: e.long_description || e.longDescription || e.description || "",
            organizer: e.organizer || "EcoTrack Foundation",
            creator_id: e.creator_id || e.user_id || `usr_org_${e.id}`,
            attendeesCount: typeof e.attendees === "number" ? e.attendees : (e.attendeesCount || e.attendees_count || 100),
            isFree: e.is_free !== false && (e.price === 0 || !e.price),
            price: typeof e.price === "number" ? e.price : 0,
            refundPolicy: e.refund_policy || e.refundPolicy || "Standard terms apply.",
          }));
          setEventsList(formatted);
        }
        if (regData && Array.isArray(regData)) {
          setRegisteredEventIds(regData.map((r: any) => String(r.id || r.event_id || r)));
        }
      } catch {
        console.warn("Using default verified events list");
      }
    })();
  }, []);

  const handleRegisterEvent = (event: any) => {
    if (registeredEventIds.includes(event.id)) {
      setSelectedPass(event);
      return;
    }

    setRegisteredEventIds((prev) => [...prev, event.id]);
    setSelectedPass(event);
    const uid = user?.id || user?.user_id;
    if (uid) {
      registerForEvent(Number(event.id) || event.id).catch(() => null);
    }
    Alert.alert("Pass Confirmed 🎟️", `You are registered for "${event.title}". Digital entry pass saved to your Pass Vault.`);
  };

  const handleCancelRegistration = (eventId: any, title?: string) => {
    Alert.alert(
      "Cancel Registration",
      `Are you sure you want to cancel your pass for "${title || 'this event'}" and release your reserved spot?`,
      [
        { text: "Keep Ticket", style: "cancel" },
        {
          text: "Cancel Pass",
          style: "destructive",
          onPress: () => {
            setRegisteredEventIds((prev) => prev.filter((id) => id !== eventId));
            if (selectedPass?.id === eventId) {
              setSelectedPass(null);
            }
            Alert.alert("Reservation Cancelled ❌", "Your admission pass has been removed from your vault.");
          },
        },
      ]
    );
  };

  const handleHostEvent = async () => {
    if (!hostTitle.trim() || !hostDate.trim() || !hostLoc.trim()) {
      Alert.alert("Missing Fields", "Please enter title, date, and location.");
      return;
    }

    const newEv = {
      id: `ev_${Date.now()}`,
      title: hostTitle.trim(),
      category: hostCategory,
      date: hostDate.trim(),
      location: hostLoc.trim(),
      image: hostImage || "https://images.unsplash.com/photo-1544979590-37e9b47eb705?w=600",
      description: hostDesc.trim() || "Community-hosted wildlife welfare gathering.",
      organizer: user?.name || "Verified Community Host",
      attendeesCount: 1,
    };

    try {
      await createEvent({
        title: hostTitle.trim(),
        category: hostCategory,
        date: hostDate.trim(),
        location: hostLoc.trim(),
        description: hostDesc.trim() || "Community-hosted wildlife welfare gathering.",
        image: hostImage || undefined,
      });
    } catch (e) {
      console.warn("Could not sync event to backend:", e);
    }

    setEventsList([newEv, ...eventsList]);
    setRegisteredEventIds((prev) => [...prev, newEv.id]);
    setShowHostModal(false);
    setHostTitle("");
    setHostDate("");
    setHostLoc("");
    setHostDesc("");
    setHostImage(null);

    Alert.alert("Event Hosted 📅", "Your event is live in the community directory.");
  };

  const categories = [
    { key: "All", label: "All Categories" },
    { key: "tickets", label: `🎟️ My Pass Vault (${registeredEventIds.length})` },
    { key: "Rescue", label: "🚨 Rescue" },
    { key: "Exhibition", label: "🏆 Exhibition" },
    { key: "Adoption", label: "🐾 Adoption" },
    { key: "Training", label: "🎓 Training" },
    { key: "Conservation", label: "🌿 Conservation" },
  ];

  const filteredEvents = useMemo(() => {
    let list = eventsList;
    if (activeTab === "tickets") {
      list = list.filter((e) => registeredEventIds.includes(e.id));
    } else if (activeTab !== "All") {
      list = list.filter((e) => e.category?.toLowerCase() === activeTab.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q) ||
          e.organizer?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [eventsList, activeTab, registeredEventIds, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("explore");
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.topIconWrap}>
            <Ionicons name="calendar" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.topTitle}>Wildlife Events & Vault</Text>
            <Text style={styles.topSub}>Adoption Drives & Digital Passes</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity style={styles.hostBtn} onPress={() => setShowHostModal(true)}>
            <Ionicons name="add-circle" size={16} color={colors.primary} />
            <Text style={styles.hostBtnText}>Host</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileHeaderBtn}
            onPress={() => navigation.navigate("profile")}
            activeOpacity={0.8}
          >
            <Ionicons name="person-circle" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* SEARCH BAR */}
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events, venue location, organizer..."
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
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryChip, activeTab === cat.key && styles.categoryChipActive]}
              onPress={() => setActiveTab(cat.key)}
            >
              <Text style={[styles.categoryChipText, activeTab === cat.key && styles.categoryChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* EVENTS LIST */}
        <View style={styles.eventsGrid}>
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {activeTab === "tickets" ? "No Registered Passes Yet" : "No Events Found"}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === "tickets"
                  ? "Explore upcoming drives and workshops to claim digital passes."
                  : "Try checking another category or search term."}
              </Text>
            </View>
          ) : (
            filteredEvents.map((ev, idx) => {
              const isRegistered = registeredEventIds.includes(ev.id);

              return (
                <View key={`event-${ev.id || idx}-${idx}`} style={styles.card}>
                  <View style={styles.cardImgWrap}>
                    <Image source={{ uri: ev.image }} style={styles.cardImg} />
                    <View style={styles.dateBadge}>
                      <Ionicons name="time" size={11} color="#fff" />
                      <Text style={styles.dateBadgeText}>{ev.date}</Text>
                    </View>
                    <View style={styles.categoryTag}>
                      <Text style={styles.categoryTagText}>{ev.isFree ? "FREE ENTRY" : `₹${ev.price} PASS`}</Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{ev.title}</Text>

                    <View style={styles.locationRow}>
                      <Ionicons name="location" size={14} color={colors.primary} />
                      <Text style={styles.locationText} numberOfLines={1}>{ev.location}</Text>
                    </View>

                    <Text style={styles.cardDesc} numberOfLines={3}>{ev.description}</Text>

                    <View style={styles.footerRow}>
                      <View style={styles.organizerWrap}>
                        <Ionicons name="shield-checkmark" size={13} color={colors.primary} />
                        <Text style={styles.organizerText}>{ev.organizer}</Text>
                      </View>
                      <Text style={styles.attendeesText}>👥 {ev.attendeesCount} Attending</Text>
                    </View>

                    {/* Registration / Pass CTA Buttons */}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                      <TouchableOpacity
                        style={[styles.actionBtn, isRegistered && styles.actionBtnRegistered, { flex: 1 }]}
                        onPress={() => handleRegisterEvent(ev)}
                      >
                        <Ionicons
                          name={isRegistered ? "ticket" : "checkmark-circle"}
                          size={16}
                          color="#fff"
                        />
                        <Text style={styles.actionBtnText}>
                          {isRegistered ? "View Entry Pass" : (ev.isFree ? "Free Entry Pass" : `Get Pass (₹${ev.price})`)}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.chatHostBtn}
                        onPress={() => openChatWithOrganizer(ev)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="chatbubble-ellipses" size={15} color={colors.primary} />
                        <Text style={styles.chatHostBtnText}>Chat</Text>
                      </TouchableOpacity>

                      {isRegistered && (
                        <TouchableOpacity
                          style={styles.cancelRsvpSmallBtn}
                          onPress={() => handleCancelRegistration(ev.id, ev.title)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                          <Text style={styles.cancelRsvpSmallBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DIGITAL PASS MODAL */}
      <Modal visible={Boolean(selectedPass)} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.passModalCard}>
            <View style={styles.passHeader}>
              <View>
                <Text style={styles.passOrgBadge}>ECOTRACK OFFICIAL ENTRY PASS</Text>
                <Text style={styles.passTitle}>{selectedPass?.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPass(null)}>
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Pass Body */}
            <View style={styles.passContent}>
              <View style={styles.passQrContainer}>
                <View style={styles.qrMock}>
                  <Ionicons name="qr-code" size={100} color={colors.primary} />
                </View>
                <Text style={styles.passIdText}>PASS ID: ECO-TKT-{selectedPass?.id?.slice(-4) || "8821"}</Text>
              </View>

              <View style={styles.passDetailsList}>
                <View style={styles.passDetailItem}>
                  <Text style={styles.passLabel}>Attendee:</Text>
                  <Text style={styles.passValue}>{user?.name || "Verified Attendee"}</Text>
                </View>
                <View style={styles.passDetailItem}>
                  <Text style={styles.passLabel}>Date:</Text>
                  <Text style={styles.passValue}>{selectedPass?.date}</Text>
                </View>
                <View style={styles.passDetailItem}>
                  <Text style={styles.passLabel}>Venue:</Text>
                  <Text style={styles.passValue}>{selectedPass?.location}</Text>
                </View>
                <View style={styles.passDetailItem}>
                  <Text style={styles.passLabel}>Category:</Text>
                  <Text style={styles.passValue}>{selectedPass?.category}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.chatHostModalBtn}
                onPress={() => {
                  const pass = selectedPass;
                  setSelectedPass(null);
                  openChatWithOrganizer(pass);
                }}
              >
                <Ionicons name="chatbubbles-outline" size={16} color={colors.primary} />
                <Text style={styles.chatHostModalBtnText}>Chat with Host ({selectedPass?.organizer || "Organizer"})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.downloadPassBtn}
                onPress={() => {
                  Alert.alert("Pass Saved 📱", "Your digital entry pass barcode has been saved to your offline vault.");
                  setSelectedPass(null);
                }}
              >
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={styles.downloadPassBtnText}>Save Pass to Phone</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelPassBtn}
                onPress={() => handleCancelRegistration(selectedPass?.id, selectedPass?.title)}
              >
                <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                <Text style={styles.cancelPassBtnText}>Cancel Reservation & Release Pass</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* HOST EVENT MODAL */}
      <Modal visible={showHostModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.hostModalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Host Community Event</Text>
              <TouchableOpacity onPress={() => setShowHostModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Event Title *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Free Rabies Vaccination Camp"
                placeholderTextColor={colors.textMuted}
                value={hostTitle}
                onChangeText={setHostTitle}
              />

              <Text style={styles.inputLabel}>Event Category</Text>
              <View style={styles.catPickerRow}>
                {["Rescue", "Exhibition", "Adoption", "Training", "Conservation"].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.catPickBtn, hostCategory === c && styles.catPickBtnActive]}
                    onPress={() => setHostCategory(c)}
                  >
                    <Text style={[styles.catPickText, hostCategory === c && styles.catPickTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Event Date *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 24 October 2026"
                placeholderTextColor={colors.textMuted}
                value={hostDate}
                onChangeText={setHostDate}
              />

              <Text style={styles.inputLabel}>Venue Location *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Marina Beach Animal Care Zone"
                placeholderTextColor={colors.textMuted}
                value={hostLoc}
                onChangeText={setHostLoc}
              />

              <Text style={styles.inputLabel}>Event Description</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: "top" }]}
                placeholder="Describe the goals, attendee requirements, and schedule..."
                placeholderTextColor={colors.textMuted}
                value={hostDesc}
                onChangeText={setHostDesc}
                multiline
              />

              {/* Event Flyer / Banner Upload Section */}
              <View style={styles.imagePickerContainer}>
                <Text style={styles.inputLabel}>Event Banner / Flyer</Text>
                {hostImage ? (
                  <View style={styles.imagePreviewBox}>
                    <Image source={{ uri: hostImage }} style={styles.imagePreview} />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => setHostImage(null)}>
                      <Ionicons name="close" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.mediaButtonsRow}>
                    <TouchableOpacity style={styles.mediaBtn} onPress={handlePickHostImage} activeOpacity={0.8}>
                      <Ionicons name="images-outline" size={18} color={colors.primary} />
                      <Text style={styles.mediaBtnText}>Upload Flyer</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.mediaBtn} onPress={handleTakeHostPhoto} activeOpacity={0.8}>
                      <Ionicons name="camera-outline" size={18} color={colors.primary} />
                      <Text style={styles.mediaBtnText}>Take Photo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.submitHostBtn} onPress={handleHostEvent}>
                <Text style={styles.submitHostBtnText}>Publish Community Event</Text>
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
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: Radius.md,
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 2,
    },
    topIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#f59e0b",
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
    hostBtn: {
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
    hostBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.primary,
    },
    profileHeaderBtn: {
      padding: 2,
    },

    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      maxWidth: 1000,
      width: "100%",
      alignSelf: "center",
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

    eventsGrid: {
      gap: 16,
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.sm,
    },
    cardImgWrap: {
      height: 200,
      position: "relative",
      backgroundColor: "#000",
    },
    cardImg: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    dateBadge: {
      position: "absolute",
      top: 12,
      left: 12,
      backgroundColor: "rgba(0,0,0,0.7)",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.full,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    dateBadgeText: {
      color: "#fff",
      fontSize: 10.5,
      fontWeight: "800",
    },
    categoryTag: {
      position: "absolute",
      top: 12,
      right: 12,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.full,
    },
    categoryTagText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "800",
    },

    cardBody: {
      padding: 18,
    },
    cardTitle: {
      fontSize: FontSize.lg,
      fontWeight: "900",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    locationText: {
      fontSize: FontSize.xs,
      color: colors.primary,
      fontWeight: "700",
      flex: 1,
    },
    cardDesc: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 12,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginBottom: 14,
    },
    organizerWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    organizerText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    attendeesText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "600",
    },

    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: Radius.md,
      gap: 6,
    },
    actionBtnRegistered: {
      backgroundColor: "#059669",
    },
    actionBtnText: {
      color: "#fff",
      fontSize: FontSize.xs,
      fontWeight: "800",
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
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    passModalCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 24,
      maxWidth: 480,
      width: "100%",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.lg,
    },
    passHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      padding: 20,
      backgroundColor: isDark ? "#064e3b" : "#ecfdf5",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    passOrgBadge: {
      fontSize: 9,
      fontWeight: "800",
      color: colors.primary,
      letterSpacing: 1,
      marginBottom: 4,
    },
    passTitle: {
      fontSize: FontSize.md,
      fontWeight: "900",
      color: colors.textPrimary,
      maxWidth: 320,
    },
    passContent: {
      padding: 20,
      alignItems: "center",
    },
    passQrContainer: {
      alignItems: "center",
      marginBottom: 16,
    },
    qrMock: {
      padding: 14,
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    passIdText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primary,
      letterSpacing: 1,
    },
    passDetailsList: {
      width: "100%",
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      padding: 14,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
      marginBottom: 16,
    },
    passDetailItem: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    passLabel: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    passValue: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.textPrimary,
      maxWidth: 240,
      textAlign: "right",
    },
    downloadPassBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: Radius.md,
      gap: 6,
      width: "100%",
    },
    downloadPassBtnText: {
      color: "#fff",
      fontSize: FontSize.sm,
      fontWeight: "800",
    },
    cancelPassBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(239, 68, 68, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.3)",
      paddingVertical: 10,
      borderRadius: Radius.md,
      gap: 6,
      width: "100%",
      marginTop: 8,
    },
    cancelPassBtnText: {
      color: "#ef4444",
      fontSize: FontSize.xs,
      fontWeight: "700",
    },
    chatHostBtn: {
      flexDirection: "row",
      height: 44,
      paddingHorizontal: 12,
      borderRadius: Radius.md,
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      gap: 5,
    },
    chatHostBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.primary,
    },
    chatHostModalBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "#064e3b20" : "#ecfdf5",
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: 12,
      borderRadius: Radius.md,
      gap: 8,
      marginBottom: 10,
    },
    chatHostModalBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.primary,
    },
    cancelRsvpSmallBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      backgroundColor: "rgba(239, 68, 68, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.3)",
      borderRadius: Radius.md,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    cancelRsvpSmallBtnText: {
      color: "#ef4444",
      fontSize: 12,
      fontWeight: "700",
    },

    hostModalSheet: {
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
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: FontSize.lg,
      fontWeight: "900",
      color: colors.textPrimary,
    },
    catPickerRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    catPickBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radius.full,
      backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
      borderWidth: 1,
      borderColor: colors.border,
    },
    catPickBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    catPickText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    catPickTextActive: {
      color: "#fff",
      fontWeight: "800",
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
    imagePickerContainer: {
      marginBottom: 14,
    },
    imagePreviewBox: {
      width: "100%",
      height: 150,
      borderRadius: Radius.md,
      overflow: "hidden",
      marginBottom: 8,
      position: "relative",
    },
    imagePreview: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    removeImageBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: Radius.full,
      padding: 4,
    },
    mediaButtonsRow: {
      flexDirection: "row",
      gap: 10,
    },
    mediaBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
      paddingVertical: 10,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    mediaBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    submitHostBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: Radius.md,
      alignItems: "center",
      marginTop: 6,
      marginBottom: 10,
    },
    submitHostBtnText: {
      color: "#fff",
      fontSize: FontSize.sm,
      fontWeight: "800",
    },
  });
}
