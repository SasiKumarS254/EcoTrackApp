import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, Modal, Alert, StatusBar, Dimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { fetchMarketplaceAnimals, fetchMarketplaceProducts, createListing } from "../../services/api";



const resolveItemImage = (img?: string | null, fallback = "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600") => {
  if (!img) return fallback;
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  if (img.startsWith("assets/")) {
    const assetMap: Record<string, string> = {
      "assets/pet_bed.jpg": "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600",
      "assets/bird_cage.jpg": "https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600",
      "assets/pet_shampoo.jpg": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600",
      "assets/dog_tracker.jpg": "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600",
      "assets/dog_harness.jpg": "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600",
      "assets/organic_kibble.jpg": "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600",
      "assets/dog_kibble.jpg": "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600",
      "assets/saline_wash.jpg": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600",
      "assets/dog_bowl.jpg": "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600",
    };
    return assetMap[img] || fallback;
  }
  return img;
};

const BASE_ANIMALS = [
  {
    id: 101,
    name: "Purebred German Shepherd Pup",
    title: "Purebred German Shepherd Pup",
    species: "Dog",
    gender: "Male",
    type: "sale",
    age: "8 Weeks",
    price: "₹15,000",
    priceStr: "₹15,000",
    priceNum: 15000,
    location: "Chennai, TN",
    image: "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600",
    breed: "German Shepherd",
    description: "AKC-line purebred with full vaccination certificate. Health tested parents.",
    vaccinated: true,
    sellerId: "usr_apex_k9",
    sellerName: "Apex K9 Kennels",
    seller: "Apex K9 Kennels",
  },
  {
    id: 104,
    name: "Golden Retriever (Adoption)",
    title: "Golden Retriever (Adoption)",
    species: "Dog",
    gender: "Female",
    type: "adoption",
    age: "2 Years",
    price: "Free Adoption",
    priceStr: "Free Adoption",
    priceNum: 0,
    location: "Hyderabad, TS",
    image: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=400",
    breed: "Golden Retriever",
    description: "Rescued Golden Retriever. Neutered, vaccinated, socialized. Needs a loving home.",
    vaccinated: true,
    sellerId: "usr_golden_haven",
    sellerName: "Golden Haven Sanctuary",
    seller: "Golden Haven Sanctuary",
  },
  {
    id: 107,
    name: "Rescued Indie Puppy - Bruno",
    title: "Rescued Indie Puppy - Bruno",
    species: "Dog",
    gender: "Male",
    type: "adoption",
    age: "3 Months",
    price: "Free Adoption",
    priceStr: "Free Adoption",
    priceNum: 0,
    location: "Chennai, TN",
    image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600",
    breed: "Indian Pariah",
    description: "Playful and loving Indie pup rescued from the streets. Fully vaccinated and dewormed.",
    vaccinated: true,
    sellerId: "usr_paws_rescue",
    sellerName: "Paws Rescue Trust",
    seller: "Paws Rescue Trust",
  },
  {
    id: 108,
    name: "Rescued Persian Cat - Luna",
    title: "Rescued Persian Cat - Luna",
    species: "Cat",
    gender: "Female",
    type: "adoption",
    age: "1 Year",
    price: "Free Adoption",
    priceStr: "Free Adoption",
    priceNum: 0,
    location: "Bangalore, KA",
    image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600",
    breed: "Persian",
    description: "Gentle and affectionate Persian cat looking for a quiet, warm home. Vaccinated and litter trained.",
    vaccinated: true,
    sellerId: "usr_kavita_persian",
    sellerName: "Kavita Reddy",
    seller: "Kavita Reddy",
  },
  {
    id: 109,
    name: "Hand-Reared Sun Conure - Rio",
    title: "Hand-Reared Sun Conure - Rio",
    species: "Bird",
    gender: "Male",
    type: "sale",
    age: "6 Months",
    price: "₹8,500",
    priceStr: "₹8,500",
    priceNum: 8500,
    location: "Mumbai, MH",
    image: "https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600",
    breed: "Sun Conure",
    description: "Tame, step-up trained hand-reared Sun Conure. Vibrant plumage and high cognitive intelligence.",
    vaccinated: true,
    sellerId: "usr_avian_care",
    sellerName: "Avian Care World",
    seller: "Avian Care World",
  },
  {
    id: 110,
    name: "Thoroughbred Colt - Sultan",
    title: "Thoroughbred Colt - Sultan",
    species: "Horse",
    gender: "Male",
    type: "sale",
    age: "3 Years",
    price: "₹185,000",
    priceStr: "₹185,000",
    priceNum: 185000,
    location: "Pune, MH",
    image: "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=600",
    breed: "Marwari / Thoroughbred",
    description: "Healthy and agile athletic young stallion with excellent stamina and regal carriage.",
    vaccinated: true,
    sellerId: "usr_royal_stables",
    sellerName: "Royal Equine Stables",
    seller: "Royal Equine Stables",
  },
  {
    id: 111,
    name: "Holland Lop Bunny - Thumper",
    title: "Holland Lop Bunny - Thumper",
    species: "Rabbit",
    gender: "Male",
    type: "adoption",
    age: "5 Months",
    price: "Free Adoption",
    priceStr: "Free Adoption",
    priceNum: 0,
    location: "Chennai, TN",
    image: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=600",
    breed: "Holland Lop",
    description: "Super calm and friendly indoor bunny rabbit. Dewormed and loves fresh greens.",
    vaccinated: true,
    sellerId: "usr_chennai_paws",
    sellerName: "Chennai Animal Rescue",
    seller: "Chennai Animal Rescue",
  },
];

const BASE_PRODUCTS = [
  {
    id: 102,
    name: "Orthopedic Memory Foam Pet Bed",
    title: "Orthopedic Memory Foam Pet Bed",
    category: "Gear",
    price: 1499,
    priceNum: 1499,
    priceStr: "₹1,499",
    image: "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600",
    description: "High-density memory foam with waterproof cover. Suitable for dogs up to 30kg.",
    location: "Bangalore, KA",
    sellerId: "usr_comfort_paws",
    sellerName: "ComfortPaws Pet Supplies",
    seller: "ComfortPaws Pet Supplies",
  },
  {
    id: 103,
    name: "Premium Bird Habitat Cage (Large)",
    title: "Premium Bird Habitat Cage (Large)",
    category: "Housing",
    price: 3500,
    priceNum: 3500,
    priceStr: "₹3,500",
    image: "https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600",
    description: "Powder-coated steel cage with multiple perches, feeding stations and tray.",
    location: "Mumbai, MH",
    sellerId: "usr_avian_care",
    sellerName: "Avian Care World",
    seller: "Avian Care World",
  },
  {
    id: 105,
    name: "Organic Aloe & Oatmeal Pet Shampoo",
    title: "Organic Aloe & Oatmeal Pet Shampoo",
    category: "Supplies",
    price: 499,
    priceNum: 499,
    priceStr: "₹499",
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600",
    description: "Soothing organic aloe vera formula for dogs and cats. Relieves itchy skin.",
    location: "Chennai, TN",
    sellerId: "usr_vetcare_meds",
    sellerName: "VetCare Organics",
    seller: "VetCare Organics",
  },
  {
    id: 106,
    name: "Ergonomic GPS Animal Tracker Harness",
    title: "Ergonomic GPS Animal Tracker Harness",
    category: "Gear",
    price: 1899,
    priceNum: 1899,
    priceStr: "₹1,899",
    image: "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600",
    description: "Real-time GPS tracker harness with reflective safety strips.",
    location: "Bangalore, KA",
    sellerId: "usr_rex_gear",
    sellerName: "Rex Gear Official",
    seller: "Rex Gear Official",
  },
  {
    id: 201,
    name: "Organic Canine Kibble 10kg",
    title: "Organic Canine Kibble 10kg",
    category: "Food",
    price: 2499,
    priceNum: 2499,
    priceStr: "₹2,499",
    image: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600",
    description: "Grain-free canine nutrition formulated for active dogs. High protein with chicken and brown rice.",
    location: "Chennai, TN",
    sellerId: "usr_ecopet",
    sellerName: "EcoPet Supplies",
    seller: "EcoPet Supplies",
  },
  {
    id: 203,
    name: "Sterile Saline Wash & Antiseptic First Aid",
    title: "Sterile Saline Wash & Antiseptic First Aid",
    category: "Medical",
    price: 450,
    priceNum: 450,
    priceStr: "₹450",
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600",
    description: "Essential veterinary first-aid antiseptic saline for cleaning animal wounds and eye flushing.",
    location: "Chennai, TN",
    sellerId: "usr_vetcare_meds",
    sellerName: "VetCare Organics",
    seller: "VetCare Organics",
  },
];

export default function MarketplaceScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // Tab: 'animals' | 'products' | 'saved'
  const [activeTab, setActiveTab] = useState<"animals" | "products" | "saved">("animals");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDetailItem, setSelectedDetailItem] = useState<any>(null);

  // Data lists
  const [animalsList, setAnimalsList] = useState<any[]>(BASE_ANIMALS);
  const [productsList, setProductsList] = useState<any[]>(BASE_PRODUCTS);
  const [favorites, setFavorites] = useState<Record<number, boolean>>({});
  const [cart, setCart] = useState<any[]>([]);

  // Modals
  const [showCartModal, setShowCartModal] = useState(false);
  const [showListingModal, setShowListingModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("adoption");
  const [newListingImage, setNewListingImage] = useState<string | null>(null);

  const handlePickListingImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Media library access is needed to choose listing photos.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setNewListingImage(res.assets[0].uri);
      }
    } catch {
      Alert.alert("Picker Error", "Could not choose photo from gallery.");
    }
  };

  const handleTakeListingPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Camera Permission Required", "Camera access is needed to capture listing photos.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setNewListingImage(res.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Camera Error", "Could not open camera.");
    }
  };


  useEffect(() => {
    (async () => {
      try {
        const [a, p] = await Promise.all([
          fetchMarketplaceAnimals().catch(() => null),
          fetchMarketplaceProducts().catch(() => null),
        ]);
        if (a && Array.isArray(a) && a.length > 0) {
          const formatted = a.map((item: any) => {
            const sellerId = item.sellerId || item.seller_id || (typeof item.seller === "object" ? item.seller?.id : null) || item.user_id || `usr_seller_${item.id}`;
            const sellerName = typeof item.seller === "object" ? item.seller?.name : (item.seller || item.sellerName || "Verified Caretaker");
            return {
              id: item.id,
              name: item.name || item.title,
              title: item.title || item.name,
              species: item.specs?.species || item.species || "Dog",
              gender: item.specs?.gender || item.gender || "Male",
              type: item.type || "adoption",
              age: item.age || "Young",
              price: item.price === 0 || item.type === "adoption" ? "Free Adoption" : (typeof item.price === "number" ? `₹${item.price.toLocaleString("en-IN")}` : String(item.price || "₹1,000")),
              priceStr: item.price === 0 || item.type === "adoption" ? "Free Adoption" : (typeof item.price === "number" ? `₹${item.price.toLocaleString("en-IN")}` : String(item.price || "₹1,000")),
              location: item.location || "Chennai, TN",
              image: resolveItemImage(item.image_url || item.image, "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600"),
              breed: item.breed || item.specs?.breed || "Companion",
              description: item.description || "Verified animal listing.",
              vaccinated: Boolean(item.vaccinated),
              sellerId: String(sellerId),
              sellerName: String(sellerName),
              seller: String(sellerName),
              sellerDetails: item.seller,
            };
          });
          setAnimalsList(formatted);
        }
        if (p && Array.isArray(p) && p.length > 0) {
          const formatted = p.map((item: any) => {
            const sellerId = item.sellerId || item.seller_id || (typeof item.seller === "object" ? item.seller?.id : null) || item.user_id || `usr_seller_${item.id}`;
            const sellerName = typeof item.seller === "object" ? item.seller?.name : (item.seller || item.sellerName || "Official Store");
            return {
              id: item.id,
              name: item.name || item.title,
              title: item.title || item.name,
              category: item.category || "Gear",
              price: typeof item.price === "number" ? item.price : 499,
              priceNum: typeof item.price === "number" ? item.price : 499,
              priceStr: typeof item.price === "number" ? `₹${item.price.toLocaleString("en-IN")}` : String(item.price || "₹499"),
              image: resolveItemImage(item.image_url || item.image, "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600"),
              description: item.description || "EcoTrack verified accessory.",
              location: item.location || "Available for delivery",
              sellerId: String(sellerId),
              sellerName: String(sellerName),
              seller: String(sellerName),
              sellerDetails: item.seller,
            };
          });
          setProductsList(formatted);
        }
      } catch (e) {
        console.warn("Using offline marketplace catalog");
      }
    })();
  }, []);

  const toggleFavorite = (id: number) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
    Alert.alert("Added to Cart 🛍️", `${product.name} added to your shopping cart.`);
  };

  const updateCartQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price || item.priceNum || 0) * item.qty, 0);
  }, [cart]);

  const handleCreateListing = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Missing Field", "Please enter listing title.");
      return;
    }
    const item = {
      id: Date.now(),
      name: newTitle.trim(),
      species: "Dog",
      type: newType,
      age: "Young",
      price: newType === "adoption" ? "Free Adoption" : (newPrice ? `₹${newPrice}` : "₹1,000"),
      location: "Local Community",
      image: newListingImage || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600",
      breed: "Standard",
      description: newDesc || "Community animal listing.",
      vaccinated: true,
      seller: "You (Active User)",
    };

    try {
      await createListing({
        title: newTitle.trim(),
        price: newType === "adoption" ? 0 : (parseInt(newPrice) || 1000),
        category: "Pets",
        type: newType,
        description: newDesc || "Community animal listing.",
        location: "Local Community",
        image: newListingImage || undefined,
      });
    } catch (e) {
      console.warn("Could not sync listing to backend:", e);
    }

    setAnimalsList([item, ...animalsList]);
    setShowListingModal(false);
    setNewTitle("");
    setNewPrice("");
    setNewDesc("");
    setNewListingImage(null);
    Alert.alert("Listing Published 🎉", "Your animal listing has been published to the community marketplace.");
  };

  // Direct Real User-to-User Chat with Seller
  const openChatWithSeller = (item: any) => {
    const sellerId =
      item.sellerId ||
      item.seller_id ||
      (typeof item.seller === "object" ? item.seller?.id : null) ||
      item.user_id ||
      item.sellerDetails?.id ||
      `usr_seller_${item.id}`;
    const sellerName =
      typeof item.seller === "object"
        ? item.seller?.name
        : (item.seller || item.sellerName || item.sellerDetails?.name || "Verified Seller");

    router.push({
      pathname: "/chat/[id]",
      params: {
        id: String(sellerId),
        name: String(sellerName),
        listingId: String(item.id),
      },
    });
  };

  // Filtered List
  const displayedItems = useMemo(() => {
    let list: any[] = [];
    if (activeTab === "animals") {
      list = animalsList;
      if (selectedCategory !== "All") {
        const cat = selectedCategory.toLowerCase();
        if (cat === "adoption") {
          list = list.filter((item) => item.type === "adoption" || String(item.price || "").toLowerCase().includes("free"));
        } else if (cat === "sale") {
          list = list.filter((item) => item.type === "sale" && !String(item.price || "").toLowerCase().includes("free") && item.price !== 0);
        } else {
          list = list.filter((item) => item.species?.toLowerCase() === cat || item.breed?.toLowerCase().includes(cat));
        }
      }
    } else if (activeTab === "products") {
      list = productsList;
      if (selectedCategory !== "All") {
        list = list.filter((item) => item.category?.toLowerCase() === selectedCategory.toLowerCase());
      }
    } else if (activeTab === "saved") {
      list = [...animalsList, ...productsList].filter((item) => favorites[item.id]);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.name?.toLowerCase().includes(q) ||
          item.species?.toLowerCase().includes(q) ||
          item.breed?.toLowerCase().includes(q) ||
          item.location?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeTab, animalsList, productsList, favorites, selectedCategory, searchQuery]);

  const secondaryFilters = useMemo(() => {
    if (activeTab === "animals") return ["All", "Adoption", "Sale", "Dog", "Cat", "Bird", "Horse", "Rabbit"];
    if (activeTab === "products") return ["All", "Food", "Gear", "Medical", "Housing", "Supplies"];
    return [];
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.navigate("/(tabs)/explore" as any);
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.topIconWrap}>
            <Ionicons name="cart" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.topTitle}>Boutique Marketplace</Text>
            <Text style={styles.topSub}>Verified Supplies & Adoption</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => setShowListingModal(true)}>
            <Ionicons name="add-circle" size={16} color={colors.primary} />
            <Text style={styles.headerActionBtnText}>New</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cartIconBadge} onPress={() => setShowCartModal(true)}>
            <Ionicons name="cart" size={18} color={colors.primary} />
            {cart.length > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{cart.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileHeaderBtn}
            onPress={() => router.navigate("/(tabs)/profile" as any)}
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
            placeholder="Search breeds, species, supplies, or locations..."
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

        {/* PRIMARY TABS */}
        <View style={styles.primaryTabsRow}>
          <TouchableOpacity
            style={[styles.primaryTab, activeTab === "animals" && styles.primaryTabActive]}
            onPress={() => {
              setActiveTab("animals");
              setSelectedCategory("All");
            }}
          >
            <Text style={[styles.primaryTabText, activeTab === "animals" && styles.primaryTabTextActive]}>
              🐾 Animals & Adoption
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryTab, activeTab === "products" && styles.primaryTabActive]}
            onPress={() => {
              setActiveTab("products");
              setSelectedCategory("All");
            }}
          >
            <Text style={[styles.primaryTabText, activeTab === "products" && styles.primaryTabTextActive]}>
              🛍️ Products & Supplies
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryTab, activeTab === "saved" && styles.primaryTabActiveSaved]}
            onPress={() => setActiveTab("saved")}
          >
            <Ionicons
              name={activeTab === "saved" ? "heart" : "heart-outline"}
              size={14}
              color={activeTab === "saved" ? "#fff" : colors.danger}
            />
            <Text style={[styles.primaryTabText, activeTab === "saved" && styles.primaryTabTextActive]}>
              Saved ({Object.values(favorites).filter(Boolean).length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* SECONDARY FILTER CHIPS */}
        {secondaryFilters.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.secondaryScroll}>
            {secondaryFilters.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.secChip, selectedCategory === cat && styles.secChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.secChipText, selectedCategory === cat && styles.secChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* CATALOG LIST */}
        <View style={styles.catalogGrid}>
          {displayedItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="basket-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Listings Found</Text>
              <Text style={styles.emptySub}>Try searching with different keywords or filter criteria.</Text>
            </View>
          ) : (
            displayedItems.map((item, idx) => {
              const isFav = Boolean(favorites[item.id]);
              const isAnimal = Boolean(item.species);

              return (
                <View key={`market-${item.id || idx}-${idx}`} style={styles.card}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setSelectedDetailItem(item)}
                    style={styles.cardImageContainer}
                  >
                    <Image source={{ uri: item.image }} style={styles.cardImage} />

                    {/* Tag badge */}
                    <View style={styles.cardBadge}>
                      <Text style={styles.cardBadgeText}>
                        {isAnimal ? (item.type === "adoption" ? "Free Adoption" : "Verified Breeder") : item.category}
                      </Text>
                    </View>

                    {/* Heart button */}
                    <TouchableOpacity
                      style={styles.cardHeartBtn}
                      onPress={() => toggleFavorite(item.id)}
                    >
                      <Ionicons
                        name={isFav ? "heart" : "heart-outline"}
                        size={18}
                        color={isFav ? colors.danger : "#fff"}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  <View style={styles.cardBody}>
                    <View style={styles.cardHeaderLine}>
                      <Text style={styles.cardPrice}>{item.priceStr || item.price}</Text>
                      {item.vaccinated && (
                        <View style={styles.vaxBadge}>
                          <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
                          <Text style={styles.vaxText}>Vaccinated</Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity onPress={() => setSelectedDetailItem(item)} activeOpacity={0.8}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {item.description}
                    </Text>

                    <View style={styles.cardMetaRow}>
                      <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.cardMetaText}>{item.location}</Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.cardMetaText}>{item.seller}</Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.detailsBtn}
                        onPress={() => setSelectedDetailItem(item)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="information-circle-outline" size={15} color="#fff" />
                        <Text style={styles.detailsBtnText}>Details</Text>
                      </TouchableOpacity>

                      {isAnimal ? (
                        <TouchableOpacity
                          style={styles.chatSellerBtn}
                          onPress={() => openChatWithSeller(item)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="chatbubble-ellipses" size={15} color={colors.primary} />
                          <Text style={styles.chatSellerBtnText}>Chat</Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.addToCartBtn}
                            onPress={() => addToCart(item)}
                          >
                            <Ionicons name="cart" size={15} color="#fff" />
                            <Text style={styles.addToCartBtnText}>Add</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.chatSellerBtn}
                            onPress={() => openChatWithSeller(item)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="chatbubble-ellipses" size={15} color={colors.primary} />
                            <Text style={styles.chatSellerBtnText}>Chat</Text>
                          </TouchableOpacity>
                        </>
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

      {/* CART MODAL */}
      <Modal visible={showCartModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="cart" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Your Shopping Cart</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCartModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {cart.length === 0 ? (
              <View style={styles.emptyCartBox}>
                <Ionicons name="cart-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Cart is Empty</Text>
                <Text style={styles.emptySub}>Browse supplies and add products to your cart.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {cart.map((c, idx) => (
                  <View key={`cart-item-${c.id}-${idx}`} style={styles.cartItemRow}>
                    <Image source={{ uri: c.image }} style={styles.cartItemImg} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.cartItemName} numberOfLines={1}>{c.name}</Text>
                      <Text style={styles.cartItemPrice}>{c.priceStr || `₹${c.price}`}</Text>
                    </View>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQty(c.id, -1)}>
                        <Text style={styles.qtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyVal}>{c.qty}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQty(c.id, 1)}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {cart.length > 0 && (
              <View style={styles.cartFooter}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Order Total:</Text>
                  <Text style={styles.totalVal}>₹{cartTotal.toLocaleString()}</Text>
                </View>
                <TouchableOpacity
                  style={styles.checkoutBtn}
                  onPress={() => {
                    setShowCartModal(false);
                    setCart([]);
                    Alert.alert("Order Placed 🎉", "Your order has been submitted to verified partner suppliers.");
                  }}
                >
                  <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* NEW LISTING MODAL */}
      <Modal visible={showListingModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Publish Animal / Product Listing</Text>
              <TouchableOpacity onPress={() => setShowListingModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.listingTypeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, newType === "adoption" && styles.typeBtnActive]}
                  onPress={() => setNewType("adoption")}
                >
                  <Text style={[styles.typeBtnText, newType === "adoption" && styles.typeBtnTextActive]}>
                    🐾 Free Adoption
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, newType === "sale" && styles.typeBtnActive]}
                  onPress={() => setNewType("sale")}
                >
                  <Text style={[styles.typeBtnText, newType === "sale" && styles.typeBtnTextActive]}>
                    🛍️ For Sale
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Friendly Labrador Pup Looking for Home"
                placeholderTextColor={colors.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              {newType === "sale" && (
                <>
                  <Text style={styles.inputLabel}>Price (₹) *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 5000"
                    placeholderTextColor={colors.textMuted}
                    value={newPrice}
                    onChangeText={setNewPrice}
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Description & Health Notes</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: "top" }]}
                placeholder="Describe animal temperaments, vaccination status, and special care needs..."
                placeholderTextColor={colors.textMuted}
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
              />

              {/* Photo Upload Section */}
              <View style={styles.imagePickerContainer}>
                <Text style={styles.inputLabel}>Listing Photo</Text>
                {newListingImage ? (
                  <View style={styles.imagePreviewBox}>
                    <Image source={{ uri: newListingImage }} style={styles.imagePreview} />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => setNewListingImage(null)}>
                      <Ionicons name="close" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.mediaButtonsRow}>
                    <TouchableOpacity style={styles.mediaBtn} onPress={handlePickListingImage} activeOpacity={0.8}>
                      <Ionicons name="images-outline" size={18} color={colors.primary} />
                      <Text style={styles.mediaBtnText}>Upload Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.mediaBtn} onPress={handleTakeListingPhoto} activeOpacity={0.8}>
                      <Ionicons name="camera-outline" size={18} color={colors.primary} />
                      <Text style={styles.mediaBtnText}>Take Photo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.submitListingBtn} onPress={handleCreateListing}>
                <Text style={styles.submitListingBtnText}>Publish Listing</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* LISTING DETAILS MODAL (MATCHING WEBSITE INTEL REPORT / PRODUCT SPECS) */}
      <Modal visible={Boolean(selectedDetailItem)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailModalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Ionicons
                  name={selectedDetailItem?.species ? "paw" : "cube"}
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedDetailItem?.species ? "Animal Intelligence Report" : "Product Specifications"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDetailItem(null)}>
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* Hero Image */}
              <View style={styles.detailHeroImgWrap}>
                <Image source={{ uri: selectedDetailItem?.image }} style={styles.detailHeroImg} />
                <View style={styles.detailImgBadges}>
                  <View style={styles.detailSpeciesBadge}>
                    <Text style={styles.detailSpeciesBadgeText}>
                      {selectedDetailItem?.species || selectedDetailItem?.category || "Verified"}
                    </Text>
                  </View>
                  {selectedDetailItem?.vaccinated && (
                    <View style={styles.detailVaxBadge}>
                      <Ionicons name="shield-checkmark" size={12} color="#fff" />
                      <Text style={styles.detailVaxBadgeText}>Vaccinated</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Title & Price Header */}
              <View style={styles.detailTitlePriceRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.detailItemName}>{selectedDetailItem?.name}</Text>
                  <Text style={styles.detailItemSub}>
                    {selectedDetailItem?.breed
                      ? `Breed: ${selectedDetailItem?.breed}`
                      : `Category: ${selectedDetailItem?.category || "Pet Supply"}`}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.detailPriceVal}>
                    {selectedDetailItem?.priceStr || selectedDetailItem?.price}
                  </Text>
                  <Text style={styles.detailPriceSub}>
                    {selectedDetailItem?.type === "adoption" || String(selectedDetailItem?.price).toLowerCase().includes("free")
                      ? "Free Adoption"
                      : "Boutique Pricing"}
                  </Text>
                </View>
              </View>

              {/* Animal Chips */}
              {selectedDetailItem?.species && (
                <View style={styles.detailChipsRow}>
                  {selectedDetailItem?.species && (
                    <View style={[styles.detailChip, { backgroundColor: isDark ? "#064e3b30" : "#ecfdf5", borderColor: "#10b98140" }]}>
                      <Text style={[styles.detailChipText, { color: colors.primary }]}>🐾 {selectedDetailItem.species}</Text>
                    </View>
                  )}
                  {selectedDetailItem?.breed && (
                    <View style={[styles.detailChip, { backgroundColor: isDark ? "#0c4a6e30" : "#f0f9ff", borderColor: "#0284c740" }]}>
                      <Text style={[styles.detailChipText, { color: "#0284c7" }]}>🧬 {selectedDetailItem.breed}</Text>
                    </View>
                  )}
                  {selectedDetailItem?.gender && (
                    <View style={[styles.detailChip, { backgroundColor: isDark ? "#581c8730" : "#fdf4ff", borderColor: "#9333ea40" }]}>
                      <Text style={[styles.detailChipText, { color: "#9333ea" }]}>
                        {selectedDetailItem.gender === "Male" ? "♂ Male" : "♀ Female"}
                      </Text>
                    </View>
                  )}
                  {selectedDetailItem?.age && (
                    <View style={[styles.detailChip, { backgroundColor: isDark ? "#7c2d1230" : "#fff7ed", borderColor: "#ea580c40" }]}>
                      <Text style={[styles.detailChipText, { color: "#ea580c" }]}>⏳ {selectedDetailItem.age}</Text>
                    </View>
                  )}
                  {selectedDetailItem?.vaccinated && (
                    <View style={[styles.detailChip, { backgroundColor: isDark ? "#14532d30" : "#f0fdf4", borderColor: "#16a34a40" }]}>
                      <Text style={[styles.detailChipText, { color: "#16a34a" }]}>❤️ Verified Health</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Info Grid (Location & Assurance) */}
              <View style={styles.detailInfoGrid}>
                <View style={styles.detailInfoBox}>
                  <Text style={styles.detailInfoBoxLabel}>📍 LOCATION & LOGISTICS</Text>
                  <Text style={styles.detailInfoBoxVal}>{selectedDetailItem?.location}</Text>
                  <Text style={styles.detailInfoBoxSub}>
                    {selectedDetailItem?.species ? `Age: ${selectedDetailItem?.age || "Young"}` : "Fast Delivery Available"}
                  </Text>
                </View>
                <View style={styles.detailInfoBox}>
                  <Text style={styles.detailInfoBoxLabel}>🛡️ VERIFIED ASSURANCE</Text>
                  <Text style={styles.detailInfoBoxVal}>{selectedDetailItem?.seller || "Verified Caretaker"}</Text>
                  <Text style={styles.detailInfoBoxSub}>
                    {selectedDetailItem?.species
                      ? (selectedDetailItem?.vaccinated ? "✅ Vaccinated" : "Regular Checkups")
                      : "⭐ 4.9/5 Supplier Rating"}
                  </Text>
                </View>
              </View>

              {/* Description Overview */}
              <View style={styles.detailSectionBox}>
                <Text style={styles.detailSectionLabel}>LISTING OVERVIEW</Text>
                <Text style={styles.detailSectionText}>
                  {selectedDetailItem?.description || "Verified EcoTrack listing. This item has passed our welfare and safety verification protocol."}
                </Text>

                {/* Technical Specs if available */}
                {selectedDetailItem?.specs && typeof selectedDetailItem?.specs === "object" && (
                  <View style={styles.detailSpecsWrap}>
                    <Text style={styles.detailSpecsLabel}>SPECIFICATIONS</Text>
                    {Object.entries(selectedDetailItem.specs).map(([k, v]) => (
                      <View key={k} style={styles.detailSpecItem}>
                        <Text style={styles.detailSpecKey}>{k}:</Text>
                        <Text style={styles.detailSpecVal}>{String(v)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Modal Action CTA */}
              <View style={styles.detailCtaRow}>
                <TouchableOpacity
                  style={styles.detailChatCtaBtn}
                  onPress={() => {
                    const item = selectedDetailItem;
                    setSelectedDetailItem(null);
                    openChatWithSeller(item);
                  }}
                >
                  <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                  <Text style={styles.detailChatCtaBtnText}>
                    Chat with {selectedDetailItem?.species ? "Seller / Shelter" : "Supplier"}
                  </Text>
                </TouchableOpacity>

                {!selectedDetailItem?.species && (
                  <TouchableOpacity
                    style={styles.detailCartCtaBtn}
                    onPress={() => {
                      addToCart(selectedDetailItem);
                      setSelectedDetailItem(null);
                    }}
                  >
                    <Ionicons name="cart" size={18} color="#fff" />
                    <Text style={styles.detailCartCtaBtnText}>Add to Cart</Text>
                  </TouchableOpacity>
                )}
              </View>
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
      backgroundColor: "#f97316",
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
    headerRightActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    profileHeaderBtn: {
      padding: 2,
    },
    headerActionBtn: {
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
    headerActionBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.primary,
    },
    cartIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      position: "relative",
    },
    badgeCount: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: colors.danger,
      borderRadius: 9,
      width: 18,
      height: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    badgeCountText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "900",
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
      marginBottom: 14,
      gap: 10,
      ...Shadow.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: FontSize.sm,
      color: colors.textPrimary,
    },

    primaryTabsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    primaryTab: {
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    primaryTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    primaryTabActiveSaved: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    primaryTabText: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    primaryTabTextActive: {
      color: "#fff",
      fontWeight: "800",
    },

    secondaryScroll: {
      flexDirection: "row",
      marginBottom: 16,
    },
    secChip: {
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.full,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secChipActive: {
      backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
      borderColor: colors.primary,
    },
    secChipText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    secChipTextActive: {
      color: colors.primary,
      fontWeight: "800",
    },

    catalogGrid: {
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
    cardImageContainer: {
      height: 220,
      position: "relative",
      backgroundColor: "#000",
    },
    cardImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    cardBadge: {
      position: "absolute",
      top: 12,
      left: 12,
      backgroundColor: "rgba(0,0,0,0.65)",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.full,
    },
    cardBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "800",
    },
    cardHeartBtn: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },

    cardBody: {
      padding: 16,
    },
    cardHeaderLine: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    cardPrice: {
      fontSize: FontSize.lg,
      fontWeight: "900",
      color: colors.primary,
    },
    vaxBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#064e3b" : "#dcfce7",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
      gap: 4,
    },
    vaxText: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.primary,
    },
    cardTitle: {
      fontSize: FontSize.md,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    cardDesc: {
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 10,
    },
    cardMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 14,
    },
    cardMetaText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "600",
    },
    metaDot: {
      color: colors.textMuted,
      marginHorizontal: 2,
    },

    cardActionsRow: {
      flexDirection: "row",
      gap: 10,
    },
    adoptBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: Radius.md,
      gap: 6,
    },
    adoptBtnText: {
      color: "#fff",
      fontSize: FontSize.xs,
      fontWeight: "800",
    },
    addToCartBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: Radius.md,
      gap: 6,
    },
    addToCartBtnText: {
      color: "#fff",
      fontSize: FontSize.xs,
      fontWeight: "800",
    },
    detailsBtn: {
      flex: 1,
      height: 44,
      borderRadius: Radius.md,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    detailsBtnText: {
      color: "#fff",
      fontSize: FontSize.xs,
      fontWeight: "800",
    },
    detailModalSheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 28,
      width: "100%",
      maxHeight: "90%",
    },
    detailHeroImgWrap: {
      height: 220,
      borderRadius: 18,
      overflow: "hidden",
      position: "relative",
      backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
      marginBottom: 16,
    },
    detailHeroImg: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    detailImgBadges: {
      position: "absolute",
      bottom: 12,
      left: 12,
      flexDirection: "row",
      gap: 8,
    },
    detailSpeciesBadge: {
      backgroundColor: "rgba(15,23,42,0.85)",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: Radius.full,
    },
    detailSpeciesBadgeText: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    detailVaxBadge: {
      backgroundColor: "rgba(16,185,129,0.9)",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: Radius.full,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    detailVaxBadgeText: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "800",
    },
    detailTitlePriceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    detailItemName: {
      fontSize: FontSize.xl,
      fontWeight: "900",
      color: colors.textPrimary,
      lineHeight: 24,
    },
    detailItemSub: {
      fontSize: FontSize.xs,
      fontWeight: "600",
      color: colors.textSecondary,
      marginTop: 4,
    },
    detailPriceVal: {
      fontSize: 22,
      fontWeight: "900",
      color: colors.primary,
    },
    detailPriceSub: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.textMuted,
      textTransform: "uppercase",
      marginTop: 2,
    },
    detailChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 14,
    },
    detailChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.full,
      borderWidth: 1,
    },
    detailChipText: {
      fontSize: 11,
      fontWeight: "700",
    },
    detailInfoGrid: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 14,
    },
    detailInfoBox: {
      flex: 1,
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
    },
    detailInfoBoxLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.textMuted,
      marginBottom: 4,
    },
    detailInfoBoxVal: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    detailInfoBoxSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    detailSectionBox: {
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      marginBottom: 18,
    },
    detailSectionLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    detailSectionText: {
      fontSize: FontSize.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    detailSpecsWrap: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    detailSpecsLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.primary,
      marginBottom: 4,
    },
    detailSpecItem: {
      flexDirection: "row",
      gap: 6,
      marginTop: 3,
    },
    detailSpecKey: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
    },
    detailSpecVal: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    detailCtaRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    detailChatCtaBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      height: 48,
      borderRadius: Radius.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    detailChatCtaBtnText: {
      color: "#fff",
      fontSize: FontSize.sm,
      fontWeight: "800",
    },
    detailCartCtaBtn: {
      flex: 1,
      backgroundColor: "#0284c7",
      height: 48,
      borderRadius: Radius.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    detailCartCtaBtnText: {
      color: "#fff",
      fontSize: FontSize.sm,
      fontWeight: "800",
    },
    chatSellerBtn: {
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
    chatSellerBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.primary,
    },

    emptyCard: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: FontSize.lg,
      fontWeight: "800",
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 6,
    },
    emptySub: {
      fontSize: FontSize.sm,
      color: colors.textSecondary,
      textAlign: "center",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    modalSheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 18,
      width: "100%",
      maxHeight: "85%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: FontSize.lg,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    emptyCartBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 36,
    },
    cartItemRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cartItemImg: {
      width: 50,
      height: 50,
      borderRadius: 8,
    },
    cartItemName: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    cartItemPrice: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.primary,
    },
    qtyControl: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    qtyBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    qtyBtnText: {
      fontSize: FontSize.sm,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    qtyVal: {
      fontSize: FontSize.xs,
      fontWeight: "800",
      color: colors.textPrimary,
      paddingHorizontal: 6,
    },
    cartFooter: {
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    totalLabel: {
      fontSize: FontSize.md,
      fontWeight: "800",
      color: colors.textSecondary,
    },
    totalVal: {
      fontSize: FontSize.xl,
      fontWeight: "900",
      color: colors.primary,
    },
    checkoutBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: Radius.md,
      alignItems: "center",
    },
    checkoutBtnText: {
      color: "#fff",
      fontSize: FontSize.sm,
      fontWeight: "800",
    },

    listingTypeRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 14,
    },
    typeBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: Radius.md,
      backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    typeBtnTextActive: {
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
      height: 160,
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
    submitListingBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: Radius.md,
      alignItems: "center",
      marginTop: 6,
      marginBottom: 10,
    },
    submitListingBtnText: {
      color: "#fff",
      fontSize: FontSize.sm,
      fontWeight: "800",
    },
  });
}
