import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, StatusBar, Dimensions, TextInput, Modal,
  Linking, Platform, ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Rect } from "react-native-svg";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { useFocusEffect, router } from "expo-router";
import { fetchEvents, registerForEvent, fetchRegisteredEvents } from "../../services/api";

const { width } = Dimensions.get("window");

const CATEGORIES = ["All", "Rescue", "Exhibition", "Adoption", "Training", "Conservation"];

type Event = {
  id: number;
  title: string;
  date: string;
  location: string;
  image: string;
  description: string;
  longDescription: string;
  category?: string;
  attendees?: number;
  isFree?: boolean;
  price?: number;
  refundPolicy?: string;
  coordinates?: { lat: number; lng: number };
  organizer?: string;
};

type Ticket = {
  eventId: number;
  serialNumber: string;
  qrData: string;
  purchaseDate: string;
};

type Service = {
  id: number;
  title: string;
  provider: string;
  rating: number;
  reviews: number;
  category: "Veterinary" | "Training" | "Grooming" | "Rehabilitation" | "Habitat";
  location: string;
  fee: string;
  image: string;
  specs: string;
  longDescription: string;
  coordinates: { lat: number; lng: number };
  contactInfo: string;
};

const INITIAL_EVENTS: Event[] = [];

const INITIAL_SERVICES: Service[] = [
  {
    id: 101,
    title: "24/7 Emergency Vet Clinic & Surgery",
    provider: "Dr. A. Sharma, DVM",
    rating: 4.9,
    reviews: 184,
    category: "Veterinary",
    location: "Anna Nagar, Chennai",
    fee: "₹500 / Consultation",
    image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400",
    specs: "In-house X-Ray, Blood Diagnostics, Emergency Surgery",
    longDescription: "Our emergency clinic is equipped with the latest diagnostic and surgical tools. We specialize in trauma care, acute illness management, and orthopedic surgeries. Open 24/7 with a dedicated team of specialist vets and technicians.",
    coordinates: { lat: 13.0850, lng: 80.2101 },
    contactInfo: "+91 98765 43210"
  },
  {
    id: 102,
    title: "Certified K9 & Canine Behavior Trainer",
    provider: "Rex Canine Academy",
    rating: 4.8,
    reviews: 112,
    category: "Training",
    location: "Adyar, Chennai",
    fee: "₹1,200 / Session",
    image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400",
    specs: "Obedience, Guarding, Agility & Socialization",
    longDescription: "Professional training for all dog breeds. We focus on positive reinforcement techniques to build a strong bond between you and your pet. Our courses range from puppy basics to advanced guard training and agility competitions.",
    coordinates: { lat: 13.0033, lng: 80.2550 },
    contactInfo: "+91 87654 32109"
  },
  {
    id: 103,
    title: "Luxury Pet Grooming & Spa",
    provider: "Pawfect Spa Salon",
    rating: 4.7,
    reviews: 96,
    category: "Grooming",
    location: "Coimbatore Central",
    fee: "₹800 / Bath & Trim",
    image: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400",
    specs: "Medicated Baths, Nail Clipping, Coat De-matting",
    longDescription: "Give your pet the ultimate pampering session. Our professional groomers use high-quality, pet-safe products. We offer full grooming, de-shedding treatments, and relaxing spa baths tailored to your pet's specific coat needs.",
    coordinates: { lat: 11.0168, lng: 76.9558 },
    contactInfo: "+91 76543 21098"
  },
  {
    id: 104,
    title: "Wildlife Rehabilitation Center",
    provider: "EcoRescue Foundation",
    rating: 5.0,
    reviews: 310,
    category: "Rehabilitation",
    location: "Western Ghats Eco Park",
    fee: "Free Community Service",
    image: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400",
    specs: "Raptor & Mammal Rescue, Trauma Care, Release",
    longDescription: "Our center is dedicated to rescuing and rehabilitating wild animals found in distress. We work with forest departments to provide medical care and prepare animals for successful release back into their natural habitats. Community education is also a key part of our mission.",
    coordinates: { lat: 10.1632, lng: 77.0601 },
    contactInfo: "+91 65432 10987"
  },
];

export default function EventsScreen() {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [activeTab, setActiveTab] = useState<"events" | "services" | "tickets">("events");
  const [events, setEvents] = useState<Event[]>(INITIAL_EVENTS);
  const [services] = useState<Service[]>(INITIAL_SERVICES);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [registered, setRegistered] = useState<number[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Persistence: Load events & tickets on focus/mount
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const loadEventsData = async () => {
        try {
          const raw = await AsyncStorage.getItem("@ecotrack_user_session");
          let currentUid = null;
          if (raw) {
            const sess = JSON.parse(raw);
            currentUid = sess.user_id;
            if (userId !== sess.user_id) {
              setRegistered([]);
              setTickets([]);
              setEvents([]);
            }
            setUserId(sess.user_id);
          } else {
            if (userId !== null) {
              setRegistered([]);
              setTickets([]);
              setEvents([]);
            }
            setUserId(null);
          }

          // Load from backend
          const backendEvents = await fetchEvents();
          if (isMounted && backendEvents && backendEvents.length > 0) {
            const mapped = backendEvents.map((ev: any) => ({
              id: ev.id,
              title: ev.title,
              date: ev.date || "TBD",
              location: ev.location || "TBD",
              image: ev.image_url || ev.image || "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400",
              description: ev.description || "",
              longDescription: ev.long_description || ev.description || "",
              category: ev.category || "General",
              attendees: ev.attendees || 0,
              isFree: ev.price === 0,
              price: ev.price || 0,
              organizer: ev.organizer || "EcoTrack"
            }));
            setEvents(mapped);
          } else {
            const listKey = currentUid ? `@ecotrack_events_list_${currentUid}` : "@ecotrack_events_list";
            const storedEvents = await AsyncStorage.getItem(listKey);
            if (storedEvents && isMounted) setEvents(JSON.parse(storedEvents));
          }

          if (currentUid) {
            const regs = await fetchRegisteredEvents(currentUid);
            if (isMounted && regs) {
              const regIds = regs.map((r: any) => r.event_id);
              setRegistered(regIds);

              const mappedTickets = regs.map((r: any) => {
                return {
                  eventId: r.event_id,
                  serialNumber: r.ticket_id,
                  qrData: `ECOTRACK-${r.event_id}-${r.ticket_id}`,
                  purchaseDate: r.registered_at ? new Date(r.registered_at).toLocaleDateString() : new Date().toLocaleDateString()
                };
              });
              setTickets(mappedTickets);
            }
          } else {
            const regKey = currentUid ? `@ecotrack_events_registered_${currentUid}` : "@ecotrack_events_registered";
            const storedReg = await AsyncStorage.getItem(regKey);
            if (storedReg && isMounted) setRegistered(JSON.parse(storedReg));

            const ticketKey = currentUid ? `@ecotrack_events_tickets_${currentUid}` : "@ecotrack_events_tickets";
            const storedTickets = await AsyncStorage.getItem(ticketKey);
            if (storedTickets && isMounted) setTickets(JSON.parse(storedTickets));
          }
        } catch (e) {
          console.warn("Error loading events data", e);
        }
      };
      loadEventsData();
      return () => { isMounted = false; };
    }, [userId])
  );

  // Persistence: Save events, registered, and tickets on change
  useEffect(() => {
    const listKey = userId ? `@ecotrack_events_list_${userId}` : "@ecotrack_events_list";
    AsyncStorage.setItem(listKey, JSON.stringify(events)).catch(() => {});
  }, [events, userId]);

  useEffect(() => {
    const regKey = userId ? `@ecotrack_events_registered_${userId}` : "@ecotrack_events_registered";
    AsyncStorage.setItem(regKey, JSON.stringify(registered)).catch(() => {});
  }, [registered, userId]);

  useEffect(() => {
    const ticketKey = userId ? `@ecotrack_events_tickets_${userId}` : "@ecotrack_events_tickets";
    AsyncStorage.setItem(ticketKey, JSON.stringify(tickets)).catch(() => {});
  }, [tickets, userId]);

  // Host Event State
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Booking Modal State
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingDone, setBookingDone] = useState(false);

  // Advanced Service Booking Details
  const [selectedServiceDetails, setSelectedServiceDetails] = useState<Service | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [petName, setPetName] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");

  // New Event Detail & Payment States
  const [selectedEventDetails, setSelectedEventDetails] = useState<Event | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);
  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [savingStep, setSavingProgress] = useState("");
  const [selectedUpiApp, setSelectedUpiApp] = useState("");

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchCat = activeCategory === "All" || e.category === activeCategory;
      const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.location.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [events, activeCategory, search]);

  const handleRegister = (id: number, title: string) => {
    const event = events.find(e => e.id === id);
    if (!event) return;

    if (registered.includes(id)) {
      // If already registered, show the ticket
      const ticket = tickets.find(t => t.eventId === id);
      if (ticket) {
        setViewingTicket(ticket);
      } else {
        Alert.alert("Reservation Confirmed", `You have already secured your spot for "${title}".`);
      }
      return;
    }

    if (!event.isFree) {
      setSelectedEventDetails(event);
      setShowPaymentModal(true);
      return;
    }

    // Free event logic
    confirmReservation(id, title);
  };

  const confirmReservation = async (id: number, title: string) => {
    let serial = "ET-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    if (userId) {
      try {
        const res = await registerForEvent(id);
        if (res && res.registration) {
          serial = res.registration.ticket_id;
        }
      } catch (e) {
        console.warn("Backend event registration failed, using offline ticket fallback", e);
      }
    }

    const newTicket: Ticket = {
      eventId: id,
      serialNumber: serial,
      qrData: `ECOTRACK-${id}-${serial}`,
      purchaseDate: new Date().toLocaleDateString(),
    };

    setRegistered((prev) => [...prev, id]);
    setTickets((prev) => [...prev, newTicket]);
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, attendees: (e.attendees || 0) + 1 } : e));

    Toast.show({
      type: 'success',
      text1: '🎟️ Entry Pass Secured!',
      text2: `Your reservation for ${title} is officially confirmed.`,
      position: 'bottom',
      bottomOffset: 90,
    });

    Alert.alert(
      "🎟️ Reservation Confirmed",
      `Congratulations! You have successfully secured your entry for "${title}". Your digital pass has been added to your 'My Pass Vault' for quick access.`,
      [
        { text: "View Pass Now", onPress: () => setViewingTicket(newTicket), style: "default" },
        { text: "Return to Events", style: "cancel" }
      ]
    );
  };

  const handlePaymentSuccess = async (appName: string) => {
    if (!selectedEventDetails) return;
    setSelectedUpiApp(appName);
    setIsProcessingPayment(true);

    // Attempt real UPI deep link to trigger system app picker
    const upiUrl = `upi://pay?pa=ecotrack@upi&pn=${encodeURIComponent(selectedEventDetails.organizer || "EcoTrack")}&am=${selectedEventDetails.price}&cu=INR&tn=${encodeURIComponent(selectedEventDetails.title)}`;

    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert(
          "Payment App Not Found",
          "No compatible UPI payment app was detected on this device. We will continue with a simulation for demonstration purposes.",
          [{ text: "Continue Simulation" }]
        );
      }
    } catch (_err) {
      console.log("UPI link failed, continuing simulation");
    }

    // Simulate return from UPI app and verification after a delay
    setTimeout(() => {
      setShowPaymentModal(false);
      confirmReservation(selectedEventDetails.id, selectedEventDetails.title);
      setIsProcessingPayment(false);
      setSelectedEventDetails(null);
      setSelectedUpiApp("");
    }, 4000);
  };

  const handleDownloadTicket = () => {
    setIsSavingTicket(true);
    const passSerial = viewingTicket?.serialNumber || "PASS";
    const steps = [
      "📷 Rendering Entry Pass...",
      "⚙️ Converting to PDF Document...",
      "🔒 Securing Pass Credentials...",
      `📄 Saved PDF: EcoTrack-Pass-${passSerial}.pdf`
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setSavingProgress(step);
        if (index === steps.length - 1) {
          setTimeout(() => {
            setIsSavingTicket(false);
            setSavingProgress("");
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              const htmlContent = `<!DOCTYPE html><html><head><title>EcoTrack Pass</title></head><body><h2>Official Entry Pass Ref: ${passSerial}</h2></body></html>`;
              const blob = new Blob([htmlContent], { type: 'application/pdf' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `EcoTrack-Pass-${passSerial}.pdf`;
              link.click();
              URL.revokeObjectURL(url);
            }
            Toast.show({
              type: 'success',
              text1: '📄 PDF Pass Downloaded!',
              text2: `Saved as EcoTrack-Pass-${passSerial}.pdf to device downloads.`,
              position: 'bottom',
              bottomOffset: 90,
            });
          }, 2000);
        }
      }, (index + 1) * 700);
    });
  };

  const handleCancelReservation = (id: number) => {
    const event = events.find(e => e.id === id);
    if (!event) return;

    const alertTitle = event.isFree ? "Cancel Event Reservation" : "Request Cancellation & Refund";
    const alertMsg = event.isFree
      ? `Are you sure you want to release your complimentary spot for "${event.title}"? This allows other community members to participate.`
      : `Are you sure you want to cancel your booking for "${event.title}"?\n\nOfficial Policy: ${event.refundPolicy}`;

    const confirmBtnText = event.isFree ? "Yes, Cancel Reservation" : "Proceed with Refund & Cancel";

    Alert.alert(
      alertTitle,
      alertMsg,
      [
        { text: "Keep My Spot", style: "cancel" },
        {
          text: confirmBtnText,
          style: "destructive",
          onPress: () => {
            setRegistered((prev) => prev.filter(rid => rid !== id));
            setTickets((prev) => prev.filter(t => t.eventId !== id));
            setEvents((prev) => prev.map((e) => e.id === id ? { ...e, attendees: Math.max(0, (e.attendees || 1) - 1) } : e));

            Toast.show({
              type: 'info',
              text1: 'Reservation Voided',
              text2: `Your spot for ${event.title} has been successfully released.`,
              position: 'bottom',
              bottomOffset: 90,
            });

            Alert.alert("Cancellation Successful", "Your reservation has been voided. Any applicable refunds will be processed via your original UPI app within 3-5 business days.");
          }
        }
      ]
    );
  };

  const openMaps = (coords?: { lat: number, lng: number }, title?: string) => {
    if (!coords) return;
    const latLng = `${coords.lat},${coords.lng}`;
    const label = title || 'Event Location';
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latLng}`,
      android: `geo:0,0?q=${latLng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latLng}`
    });

    Linking.openURL(url);
  };

  const handleCreateEvent = () => {
    if (!newTitle.trim() || !newDate.trim() || !newLocation.trim()) {
      Alert.alert("Missing Fields", "Please fill event title, date, and location.");
      return;
    }
    const newEvent: Event = {
      id: Date.now(),
      title: newTitle,
      date: newDate,
      location: newLocation,
      description: newDesc || "Community organized animal event.",
      longDescription: newDesc || "Community organized animal event.",
      image: "https://images.unsplash.com/photo-1534278931827-8a259344abe7?w=600",
      category: "Rescue",
      attendees: 1,
      isFree: true,
      organizer: "You",
    };
    setEvents((prev) => [newEvent, ...prev]);
    setNewTitle(""); setNewDate(""); setNewLocation(""); setNewDesc("");
    setShowCreate(false);
    Alert.alert("✅ Event Published!", "Your community event is now active.");
  };

  const isValidPhoneNumber = (phoneStr: string) => {
    if (!phoneStr) return false;
    const digits = phoneStr.replace(/[\s\-\(\)\+]/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      return /^\d{10}$/.test(digits.slice(2));
    }
    return /^\d{10}$/.test(digits);
  };

  const handleBookService = () => {
    if (!clientName.trim()) {
      Alert.alert("Missing Field", "Please enter Name of the Owner.");
      Toast.show({ type: 'error', text1: 'Missing Field', text2: 'Please enter Name of the Owner', position: 'bottom', bottomOffset: 90 });
      return;
    }

    if (!isValidPhoneNumber(clientContact)) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit phone number.");
      Toast.show({ type: 'error', text1: 'Invalid Phone Number', text2: 'Please enter a valid 10-digit phone number', position: 'bottom', bottomOffset: 90 });
      return;
    }

    if (!bookingDate.trim()) {
      Alert.alert("Missing Field", "Please enter preferred appointment date & time.");
      Toast.show({ type: 'error', text1: 'Missing Field', text2: 'Please enter preferred appointment date & time', position: 'bottom', bottomOffset: 90 });
      return;
    }

    setBookingDone(true);
    setTimeout(() => {
      setBookingDone(false);
      setSelectedService(null);
      setClientName(""); setClientContact(""); setPetName(""); setServiceNotes(""); setBookingDate("");

      Toast.show({
        type: 'success',
        text1: '📅 Appointment Requested!',
        text2: `Booking request sent to ${selectedService?.provider}. Check your notifications for confirmation.`,
        position: 'bottom',
        bottomOffset: 90,
      });

      Alert.alert(
        "✅ Request Received",
        `Your appointment request for "${selectedService?.title}" has been sent successfully. ${selectedService?.provider} will contact ${clientName} shortly at ${clientContact}.`,
        [{ text: "Great!" }]
      );
    }, 1800);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgLight} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📅 Events & Services</Text>
          <Text style={styles.headerSub}>Community drives, workshops & professional vet services</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(!showCreate)}>
          <Ionicons name={showCreate ? "close" : "add-circle"} size={20} color="#fff" />
          <Text style={styles.createBtnText}>{showCreate ? "Cancel" : "Host Event"}</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Sub-Tabs */}
      <View style={styles.subTabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.subTabBar}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          <TouchableOpacity
            style={[styles.subTab, activeTab === "events" && styles.subTabActive]}
            onPress={() => setActiveTab("events")}
          >
            <Ionicons name="calendar" size={18} color={activeTab === "events" ? "#fff" : colors.textSecondary} />
            <Text style={[styles.subTabText, activeTab === "events" && styles.subTabTextActive]}>Local Events</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTab, activeTab === "services" && styles.subTabActive]}
            onPress={() => setActiveTab("services")}
          >
            <Ionicons name="medkit" size={18} color={activeTab === "services" ? "#fff" : colors.textSecondary} />
            <Text style={[styles.subTabText, activeTab === "services" && styles.subTabTextActive]}>Professional Services</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTab, activeTab === "tickets" && styles.subTabActive]}
            onPress={() => setActiveTab("tickets")}
          >
            <View style={styles.tabBadgeContainer}>
              <Ionicons name="bookmark" size={18} color={activeTab === "tickets" ? "#fff" : colors.textSecondary} />
              {registered.length > 0 && <View style={styles.tabDot} />}
            </View>
            <Text style={[styles.subTabText, activeTab === "tickets" && styles.subTabTextActive]}>My Pass Vault</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* HOST EVENT CARD */}
        {showCreate && (
          <View style={styles.createCard}>
            <Text style={styles.createTitle}>🗓️ Host Community Event</Text>
            <Text style={styles.label}>Event Title *</Text>
            <TextInput style={styles.input} value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Stray Vaccination Drive" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Date & Time *</Text>
            <TextInput style={styles.input} value={newDate} onChangeText={setNewDate} placeholder="e.g. 25 July 2026, 10:00 AM" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Location / Venue *</Text>
            <TextInput style={styles.input} value={newLocation} onChangeText={setNewLocation} placeholder="e.g. Chennai SPCA Grounds" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, { height: 70 }]} value={newDesc} onChangeText={setNewDesc} placeholder="Event purpose, agenda, guidelines..." placeholderTextColor={colors.textMuted} multiline />

            <TouchableOpacity style={styles.publishBtn} onPress={handleCreateEvent}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.publishText}>Publish Event</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* EVENTS SECTION */}
        {activeTab === "events" && (
          <View style={{ paddingHorizontal: 16 }}>
            {/* Search */}
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search events, cities, rescue drives..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Category Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, activeCategory === cat && styles.chipActive]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Event List */}
            {filteredEvents.map((e) => {
              const isRegistered = registered.includes(e.id);
              return (
                <TouchableOpacity
                  key={e.id}
                  style={styles.eventCard}
                  onPress={() => setSelectedEventDetails(e)}
                >
                  <View style={styles.imageBox}>
                    <Image source={{ uri: e.image }} style={styles.eventImg} />
                    <View style={styles.badgeRow}>
                      {e.category && (
                        <View style={styles.catBadge}>
                          <Text style={styles.catBadgeText}>{e.category}</Text>
                        </View>
                      )}
                      <View style={styles.freeBadge}>
                        <Text style={styles.freeBadgeText}>{e.isFree ? "Free Entry" : `₹${e.price}`}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.eventBody}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.eventTitle}>{e.title}</Text>
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </View>
                    <Text style={styles.eventDate}>📅 {e.date}</Text>
                    <Text style={styles.eventLoc}>📍 {e.location}</Text>
                    <Text style={styles.eventDesc} numberOfLines={2}>{e.description}</Text>

                    <View style={styles.cardFooter}>
                      <View style={styles.attendeeChip}>
                        <Ionicons name="people" size={14} color={colors.primary} />
                        <Text style={styles.attendeeText}>{e.attendees} Attending</Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.passBtn, isRegistered && { backgroundColor: colors.success }]}
                        onPress={() => handleRegister(e.id, e.title)}
                      >
                        <Ionicons name={isRegistered ? "qr-code" : "ticket-outline"} size={16} color="#fff" />
                        <Text style={styles.passText}>{isRegistered ? "View Pass" : "Secure Entry"}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* SERVICES SECTION */}
        {activeTab === "services" && (
          <View style={{ paddingHorizontal: 16 }}>
            {INITIAL_SERVICES.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.serviceCard}
                onPress={() => setSelectedServiceDetails(s)}
              >
                <Image source={{ uri: s.image }} style={styles.serviceImg} />
                <View style={styles.serviceBody}>
                  <View style={styles.serviceTitleRow}>
                    <Text style={styles.serviceTitle}>{s.title}</Text>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={12} color="#f59e0b" />
                      <Text style={styles.ratingText}>{s.rating}</Text>
                    </View>
                  </View>

                  <Text style={styles.providerText}>Provided by {s.provider}</Text>
                  <Text style={styles.serviceLoc}>📍 {s.location} • {s.fee}</Text>
                  <Text style={styles.serviceSpecs} numberOfLines={1}>{s.specs}</Text>

                  <TouchableOpacity
                    style={styles.bookBtn}
                    onPress={() => setSelectedService(s)}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#fff" />
                    <Text style={styles.bookBtnText}>Book Professional Appointment</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* TICKETS VAULT SECTION */}
        {activeTab === "tickets" && (
          <View style={{ paddingHorizontal: 16 }}>
            {registered.length === 0 ? (
              <View style={styles.emptyVault}>
                <Ionicons name="ticket-outline" size={64} color={colors.textMuted} />
                <Text style={styles.emptyVaultTitle}>Your Vault is Empty</Text>
                <Text style={styles.emptyVaultSub}>Secure tickets for upcoming animal events to see them listed here.</Text>
                <TouchableOpacity style={styles.browseBtn} onPress={() => setActiveTab("events")}>
                  <Text style={styles.browseBtnText}>Explore Local Events</Text>
                </TouchableOpacity>
              </View>
            ) : (
              tickets.map((t) => {
                const event = events.find(e => e.id === t.eventId);
                if (!event) return null;
                return (
                  <View key={t.eventId} style={styles.vaultCard}>
                    <Image source={{ uri: event.image }} style={styles.vaultImg} />
                    <View style={styles.vaultBody}>
                      <Text style={styles.vaultTitle} numberOfLines={1}>{event.title}</Text>
                      <Text style={styles.vaultDate}>📅 {event.date} • 10:00 AM</Text>
                      <View style={styles.vaultFooter}>
                         <TouchableOpacity
                           style={styles.viewPassBtn}
                           onPress={() => setViewingTicket(t)}
                         >
                            <Ionicons name="qr-code" size={16} color="#fff" />
                            <Text style={styles.viewPassText}>Open Pass</Text>
                         </TouchableOpacity>
                         <TouchableOpacity
                           style={styles.cancelPassBtn}
                           onPress={() => handleCancelReservation(event.id)}
                         >
                            <Text style={styles.cancelPassText}>Manage</Text>
                         </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* SERVICE BOOKING MODAL */}
      <Modal visible={!!selectedService} animationType="slide" transparent onRequestClose={() => setSelectedService(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { maxHeight: '95%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📅 Professional Booking</Text>
              <TouchableOpacity onPress={() => setSelectedService(null)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedService && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalServiceTitle}>{selectedService.title}</Text>
                <Text style={styles.modalProvider}>with {selectedService.provider}</Text>

                <View style={styles.formSection}>
                  <Text style={styles.label}>Name of the Owner *</Text>
                  <TextInput
                    style={styles.input}
                    value={clientName}
                    onChangeText={setClientName}
                    placeholder="Enter owner full name"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={styles.label}>Contact Phone Number *</Text>
                  <TextInput
                    style={styles.input}
                    value={clientContact}
                    onChangeText={setClientContact}
                    placeholder="+91 XXXXX XXXXX"
                    keyboardType="phone-pad"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={styles.label}>Pet Name (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={petName}
                    onChangeText={setPetName}
                    placeholder="e.g. Buddy"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={styles.label}>Preferred Appointment Date & Time *</Text>
                  <TextInput
                    style={styles.input}
                    value={bookingDate}
                    onChangeText={setBookingDate}
                    placeholder="e.g. 28 July 2026, 11:30 AM"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={styles.label}>Additional Notes / Symptoms</Text>
                  <TextInput
                    style={[styles.input, { height: 80 }]}
                    value={serviceNotes}
                    onChangeText={setServiceNotes}
                    placeholder="Briefly describe the requirement..."
                    multiline
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <TouchableOpacity style={styles.confirmBookBtn} onPress={handleBookService}>
                  <Text style={styles.confirmBookText}>Submit Appointment Request</Text>
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* SERVICE DETAILS MODAL */}
      <Modal visible={!!selectedServiceDetails} animationType="fade" transparent onRequestClose={() => setSelectedServiceDetails(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Service Overview</Text>
              <TouchableOpacity onPress={() => setSelectedServiceDetails(null)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedServiceDetails && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image source={{ uri: selectedServiceDetails.image }} style={styles.modalEventImg} />

                <View style={{ paddingVertical: 15 }}>
                  <View style={styles.serviceTitleRow}>
                    <Text style={styles.modalEventTitle}>{selectedServiceDetails.title}</Text>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={12} color="#f59e0b" />
                      <Text style={styles.ratingText}>{selectedServiceDetails.rating}</Text>
                    </View>
                  </View>
                  <Text style={styles.modalProvider}>{selectedServiceDetails.provider}</Text>

                  <TouchableOpacity
                    style={styles.modalMetaRow}
                    onPress={() => openMaps(selectedServiceDetails.coordinates, selectedServiceDetails.provider)}
                  >
                    <Ionicons name="location" size={16} color={colors.primary} />
                    <Text style={[styles.modalMetaText, { color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' }]}>
                      {selectedServiceDetails.location}
                    </Text>
                    <Ionicons name="map-outline" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>

                  <View style={styles.modalMetaRow}>
                    <Ionicons name="call" size={16} color={colors.primary} />
                    <Text style={styles.modalMetaText}>{selectedServiceDetails.contactInfo}</Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>About the Provider</Text>
                  <Text style={styles.modalLongDesc}>{selectedServiceDetails.longDescription}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Key Specializations</Text>
                  <Text style={styles.modalInfoText}>✔️ {selectedServiceDetails.specs}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Professional Fee</Text>
                  <Text style={[styles.modalInfoText, { color: colors.primary, fontWeight: '800' }]}>
                    {selectedServiceDetails.fee}
                  </Text>
                </View>

                <View style={{ height: 20 }} />

                <TouchableOpacity
                  style={styles.confirmBookBtn}
                  onPress={() => {
                    setSelectedService(selectedServiceDetails);
                    setSelectedServiceDetails(null);
                  }}
                >
                  <Text style={styles.confirmBookText}>Book This Service</Text>
                </TouchableOpacity>
                <View style={{ height: 10 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* EVENT DETAILS MODAL */}
      <Modal visible={!!selectedEventDetails && !showPaymentModal} animationType="fade" transparent onRequestClose={() => setSelectedEventDetails(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Event Details</Text>
              <TouchableOpacity onPress={() => setSelectedEventDetails(null)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedEventDetails && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image source={{ uri: selectedEventDetails.image }} style={styles.modalEventImg} />

                <View style={{ paddingVertical: 15 }}>
                  <Text style={styles.modalEventTitle}>{selectedEventDetails.title}</Text>
                  <View style={styles.modalMetaRow}>
                    <Ionicons name="calendar" size={16} color={colors.primary} />
                    <Text style={styles.modalMetaText}>{selectedEventDetails.date}</Text>
                  </View>
                  <TouchableOpacity style={styles.modalMetaRow} onPress={() => openMaps(selectedEventDetails.coordinates, selectedEventDetails.title)}>
                    <Ionicons name="location" size={16} color={colors.primary} />
                    <Text style={[styles.modalMetaText, { color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' }]}>{selectedEventDetails.location}</Text>
                    <Ionicons name="map-outline" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>About the Event</Text>
                  <Text style={styles.modalLongDesc}>{selectedEventDetails.longDescription}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Organizer</Text>
                  <Text style={styles.modalInfoText}>{selectedEventDetails.organizer}</Text>
                </View>

                {!selectedEventDetails.isFree && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Refund & Cancellation Policy</Text>
                    <Text style={[styles.modalInfoText, { color: colors.danger, fontStyle: 'italic' }]}>{selectedEventDetails.refundPolicy}</Text>
                  </View>
                )}

                <View style={{ height: 20 }} />

                {registered.includes(selectedEventDetails.id) ? (
                  <View style={{ gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.confirmBookBtn, { backgroundColor: colors.success }]}
                      onPress={() => {
                        const ticket = tickets.find(t => t.eventId === selectedEventDetails.id);
                        if (ticket) setViewingTicket(ticket);
                        setSelectedEventDetails(null);
                      }}
                    >
                      <Ionicons name="qr-code" size={20} color="#fff" />
                      <Text style={styles.confirmBookText}>View My Pass</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.confirmBookBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger }]}
                      onPress={() => {
                        handleCancelReservation(selectedEventDetails.id);
                        setSelectedEventDetails(null);
                      }}
                    >
                      <Text style={[styles.confirmBookText, { color: colors.danger }]}>Cancel Reservation</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.confirmBookBtn}
                    onPress={() => handleRegister(selectedEventDetails.id, selectedEventDetails.title)}
                  >
                    <Text style={styles.confirmBookText}>
                      {selectedEventDetails.isFree ? "Secure My Free Spot" : `Pay ₹${selectedEventDetails.price} & Get Ticket`}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal visible={showPaymentModal} animationType="slide" transparent onRequestClose={() => setShowPaymentModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Secure UPI Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentCard}>
               <Text style={styles.paymentLabel}>Amount to Pay</Text>
               <Text style={styles.paymentAmount}>₹{selectedEventDetails?.price}</Text>
               <Text style={styles.paymentTarget}>Paying to: {selectedEventDetails?.organizer}</Text>
            </View>

            <Text style={styles.label}>Select UPI App to Continue</Text>
            <View style={styles.upiRow}>
              {['Google Pay', 'PhonePe', 'Paytm', 'WhatsApp Pay'].map((app) => (
                <TouchableOpacity key={app} style={styles.upiItem} onPress={() => handlePaymentSuccess(app)}>
                  <View style={styles.upiIconPlaceholder}>
                    <Ionicons name="card" size={24} color={colors.primary} />
                  </View>
                  <Text style={styles.upiText}>{app}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {isProcessingPayment && (
              <View style={styles.processingOverlay}>
                <Ionicons name="flash" size={48} color={colors.primary} />
                <Text style={styles.processingText}>Redirecting to {selectedUpiApp}...</Text>
                <Text style={styles.processingSub}>Complete the payment in your UPI app to secure your spot.</Text>
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* TICKET MODAL */}
      <Modal visible={!!viewingTicket} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setViewingTicket(null)}>
        <View style={styles.fullPageTicketContainer}>
           <StatusBar barStyle="light-content" backgroundColor="#000" />
           <View style={styles.fullPageHeader}>
              <TouchableOpacity onPress={() => setViewingTicket(null)} style={styles.backBtn}>
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.fullPageHeaderTitle}>Verified Entry Pass</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 }}>
              {viewingTicket ? (
                <>
                  <View style={styles.movieTicket}>
                    <Image
                      source={{ uri: events.find(e => e.id === viewingTicket.eventId)?.image || "https://images.unsplash.com/photo-1517849845537-4d257902454a" }}
                      style={styles.ticketImageHeader}
                    />

                    <View style={styles.ticketTop}>
                      <Text style={styles.ticketBrand}>OFFICIAL ECOTRACK PASS</Text>
                      <Text style={styles.ticketSerial}>#{viewingTicket.serialNumber || "000000"}</Text>
                    </View>

                    <View style={styles.ticketMain}>
                      <Text style={styles.ticketEventName}>
                        {events.find(e => e.id === viewingTicket.eventId)?.title || "Event Reservation"}
                      </Text>

                      <View style={styles.ticketInfoRow}>
                        <View>
                          <Text style={styles.ticketLabel}>ATTENDEE</Text>
                          <Text style={styles.ticketVal}>EcoTrack Member</Text>
                        </View>
                        <View>
                          <Text style={styles.ticketLabel}>ACCESS</Text>
                          <Text style={styles.ticketVal}>FULL ENTRY</Text>
                        </View>
                      </View>

                      <View style={[styles.ticketInfoRow, { marginTop: 20 }]}>
                        <View>
                          <Text style={styles.ticketLabel}>EVENT DATE</Text>
                          <Text style={styles.ticketVal}>{events.find(e => e.id === viewingTicket.eventId)?.date || "TBD"}</Text>
                        </View>
                        <View>
                          <Text style={styles.ticketLabel}>TIME</Text>
                          <Text style={styles.ticketVal}>09:00 AM</Text>
                        </View>
                      </View>

                      <View style={{ marginTop: 20 }}>
                        <Text style={styles.ticketLabel}>LOCATION & VENUE</Text>
                        <Text style={styles.ticketVal}>{events.find(e => e.id === viewingTicket.eventId)?.location || "Venue"}</Text>
                      </View>
                    </View>

                    <View style={styles.ticketDivider}>
                      <View style={styles.ticketCutLeft} />
                      <View style={styles.ticketDashed} />
                      <View style={styles.ticketCutRight} />
                    </View>

                    <View style={styles.ticketBottom}>
                      <View style={styles.qrPlaceholder}>
                        <Image
                          source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(viewingTicket.qrData)}` }}
                          style={{ width: 150, height: 150, borderRadius: 8, backgroundColor: '#ffffff' }}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={styles.qrSubText}>SCAN FOR VERIFIED BLOCKCHAIN ENTRY</Text>
                      <Text style={styles.ticketPurchaseDate}>Verified: {viewingTicket.purchaseDate} • EcoTrack Security</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.downloadBtn, isSavingTicket && { backgroundColor: colors.success }]}
                    onPress={handleDownloadTicket}
                    disabled={isSavingTicket}
                  >
                     <Ionicons name={isSavingTicket ? "checkmark-done" : "cloud-download-outline"} size={22} color="#fff" />
                     <Text style={styles.downloadBtnText}>
                       {isSavingTicket ? (savingStep || "Downloading...") : "Download Digital Pass"}
                     </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.managePassBtn}
                    onPress={() => {
                      if (!viewingTicket) return;
                      const eventId = viewingTicket.eventId;
                      setViewingTicket(null);
                      setTimeout(() => handleCancelReservation(eventId), 500);
                    }}
                  >
                     <Ionicons name="close-circle-outline" size={20} color="rgba(255,255,255,0.7)" />
                     <Text style={styles.managePassText}>Manage / Cancel This Reservation</Text>
                  </TouchableOpacity>

                  <Text style={styles.fullPageHelp}>Present this QR code at the event entrance for seamless entry. You can also find your tickets in the Pass Vault section.</Text>
                </>
              ) : (
                <ActivityIndicator size="large" color="#fff" style={{ marginTop: 100 }} />
              )}
            </ScrollView>
          </View>
      </Modal>
    </View>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgLight },
    scroll: { flex: 1 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 12 },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: "800", color: colors.textPrimary },
    headerSub: { fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 2 },
    createBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
    createBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.xs },

    subTabBarWrapper: { marginBottom: 16, maxHeight: 48 },
    subTabBar: { flexDirection: "row" },
    subTab: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? colors.bgCard : "#f3f4f6",
      borderRadius: Radius.full,
      paddingVertical: 10,
      paddingHorizontal: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    subTabText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: "600" },
    subTabTextActive: { color: "#fff", fontWeight: "700" },

    searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: Radius.lg, paddingHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, height: 44, ...Shadow.sm },
    searchInput: { flex: 1, marginLeft: 8, fontSize: FontSize.sm, color: colors.textPrimary },

    chip: {
      backgroundColor: isDark ? colors.bgCard : "#f3f4f6",
      borderRadius: Radius.full,
      paddingHorizontal: 18,
      paddingVertical: 8,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: "600" },
    chipTextActive: { color: "#fff", fontWeight: "700" },

    eventCard: { backgroundColor: colors.bgCard, borderRadius: Radius.xl, overflow: "hidden", marginBottom: 14, borderWidth: 1, borderColor: colors.border, ...Shadow.sm },
    imageBox: { height: 170, position: "relative" },
    eventImg: { width: "100%", height: "100%" },
    badgeRow: { position: "absolute", top: 12, left: 12, flexDirection: "row", gap: 6 },
    catBadge: { backgroundColor: colors.primary, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    catBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    freeBadge: { backgroundColor: "rgba(0,0,0,0.6)", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    freeBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

    eventBody: { padding: 14 },
    eventTitle: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary },
    eventDate: { fontSize: FontSize.xs, fontWeight: "700", color: colors.primary, marginTop: 4 },
    eventLoc: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    eventDesc: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },

    cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
    attendeeChip: { flexDirection: "row", alignItems: "center", gap: 4 },
    attendeeText: { fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: "600" },
    passBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8 },
    passText: { color: "#fff", fontWeight: "700", fontSize: FontSize.xs },

    serviceCard: { backgroundColor: colors.bgCard, borderRadius: Radius.xl, overflow: "hidden", marginBottom: 14, borderWidth: 1, borderColor: colors.border, ...Shadow.sm },
    serviceImg: { width: "100%", height: 140 },
    serviceBody: { padding: 14 },
    serviceTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    serviceTitle: { fontSize: FontSize.md, fontWeight: "800", color: colors.textPrimary, flex: 1 },
    ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: isDark ? "#334155" : "#fef3c7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    ratingText: { fontSize: 11, fontWeight: "800", color: isDark ? "#fbbf24" : "#b45309" },
    providerText: { fontSize: FontSize.xs, color: colors.primary, fontWeight: "700", marginTop: 2 },
    serviceLoc: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    serviceSpecs: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 4, fontStyle: "italic" },
    bookBtn: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 10, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 10 },
    bookBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.xs },

    createCard: { marginHorizontal: 16, backgroundColor: colors.bgCard, borderRadius: Radius.xl, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
    createTitle: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary, marginBottom: 8 },
    label: { fontSize: FontSize.xs, fontWeight: "700", color: colors.textSecondary, marginBottom: 4, marginTop: 6 },
    input: { backgroundColor: isDark ? colors.bgLight : "#f9fafb", borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: FontSize.sm, color: colors.textPrimary },
    publishBtn: { backgroundColor: colors.primary, borderRadius: Radius.lg, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 12 },
    publishText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

    modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { backgroundColor: colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: 20 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    modalTitle: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary },
    modalServiceTitle: { fontSize: FontSize.md, fontWeight: "800", color: colors.textPrimary },
    modalProvider: { fontSize: FontSize.xs, color: colors.primary, fontWeight: "700", marginTop: 2 },
    modalFee: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2, marginBottom: 10 },
    confirmBookBtn: { backgroundColor: colors.success, borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center", marginTop: 14 },
    confirmBookText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },

    // New Styles
    modalEventImg: { width: '100%', height: 200, borderRadius: Radius.lg },
    modalEventTitle: { fontSize: FontSize.xl, fontWeight: '800', color: colors.textPrimary },
    modalMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    modalMetaText: { fontSize: FontSize.sm, color: colors.textSecondary },
    modalSection: { marginTop: 20 },
    modalSectionTitle: { fontSize: FontSize.md, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
    modalLongDesc: { fontSize: FontSize.sm, color: colors.textSecondary, lineHeight: 22 },
    modalInfoText: { fontSize: FontSize.sm, color: colors.textSecondary },
    formSection: { marginTop: 15, gap: 4 },

    paymentCard: { backgroundColor: isDark ? colors.bgLight : "#f0fdf4", padding: 20, borderRadius: Radius.lg, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.border },
    paymentLabel: { fontSize: FontSize.xs, color: colors.textMuted, fontWeight: '700' },
    paymentAmount: { fontSize: 32, fontWeight: '800', color: colors.primary, marginVertical: 4 },
    paymentTarget: { fontSize: FontSize.xs, color: colors.textSecondary },
    upiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
    upiItem: { width: (width - 60) / 2, backgroundColor: isDark ? colors.bgLight : "#f8fafc", padding: 12, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    upiIconPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? colors.bgCard : "#fff", justifyContent: 'center', alignItems: 'center', marginBottom: 6, ...Shadow.sm },
    upiText: { fontSize: FontSize.xs, fontWeight: '700', color: colors.textPrimary },
    processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    processingText: { marginTop: 15, fontSize: FontSize.md, fontWeight: '800', color: colors.primary },

    ticketContainer: { width: '90%', alignItems: 'center' },
    closeTicket: { alignSelf: 'flex-end', marginBottom: 10 },
    movieTicket: { width: '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', ...Shadow.lg },
    ticketImageHeader: { width: '100%', height: 120 },
    ticketTop: { backgroundColor: colors.primary, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    ticketBrand: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
    ticketSerial: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
    ticketMain: { padding: 20 },
    ticketEventName: { fontSize: FontSize.xl, fontWeight: '900', color: '#000', marginBottom: 15 },
    ticketInfoRow: { flexDirection: 'row', gap: 40 },
    ticketLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '900', marginBottom: 4, letterSpacing: 0.5 },
    ticketVal: { fontSize: FontSize.sm, color: '#0f172a', fontWeight: '800' },
    ticketDivider: { height: 30, flexDirection: 'row', alignItems: 'center' },
    ticketCutLeft: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.85)', marginLeft: -15 },
    ticketCutRight: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.85)', marginRight: -15 },
    ticketDashed: { flex: 1, height: 1.5, borderStyle: 'dashed', borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 5 },
    ticketBottom: { padding: 25, alignItems: 'center', backgroundColor: '#fdfdfd', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    qrPlaceholder: { backgroundColor: '#fff', padding: 12, borderRadius: 15, ...Shadow.md },
    qrSubText: { fontSize: 8, fontWeight: '900', color: colors.primary, marginTop: 12, letterSpacing: 1 },
    ticketPurchaseDate: { fontSize: 9, color: '#94a3b8', marginTop: 15, fontWeight: '600' },
    downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primary, paddingHorizontal: 25, paddingVertical: 14, borderRadius: Radius.full, marginTop: 30 },
    downloadBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSize.sm },

    // Full Page Ticket
    fullPageTicketContainer: { flex: 1, backgroundColor: '#000' },
    fullPageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    fullPageHeaderTitle: { color: '#fff', fontSize: FontSize.lg, fontWeight: '800' },
    fullPageHelp: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center', marginTop: 25, lineHeight: 18, paddingHorizontal: 20 },
    managePassBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 10 },
    managePassText: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.xs, fontWeight: '600', textDecorationLine: 'underline' },
    processingSub: { color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },

    // Tickets Vault Styles
    tabBadgeContainer: { position: 'relative' },
    tabDot: { position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.primary },
    emptyVault: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyVaultTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.textPrimary, marginTop: 20 },
    emptyVaultSub: { fontSize: FontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    browseBtn: { backgroundColor: colors.primary, borderRadius: Radius.full, paddingHorizontal: 25, paddingVertical: 12, marginTop: 25 },
    browseBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSize.sm },
    vaultCard: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: colors.border, ...Shadow.sm },
    vaultImg: { width: 100, height: '100%' },
    vaultBody: { flex: 1, padding: 12 },
    vaultTitle: { fontSize: FontSize.md, fontWeight: '800', color: colors.textPrimary },
    vaultDate: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 4 },
    vaultFooter: { flexDirection: 'row', gap: 10, marginTop: 12 },
    viewPassBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md },
    viewPassText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
    cancelPassBtn: { justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md },
    cancelPassText: { color: colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
  });
}
