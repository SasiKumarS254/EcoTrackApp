import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, Alert, StatusBar, Dimensions, Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { useTheme } from "../../context/ThemeContext";
import {
  fetchCart, addToCart as apiAddToCart, removeFromCart as apiRemoveFromCart,
  updateCart as apiUpdateCart, checkoutCart as apiCheckoutCart,
  fetchFavorites as apiFetchFavorites, toggleFavorite as apiToggleFavorite,
  fetchListings as apiFetchListings, createListing as apiCreateListing
} from "../../services/api";

const { width } = Dimensions.get("window");

type Listing = {
  id: number;
  name: string;
  age: string;
  price: string;
  location: string;
  distance: string;
  image: string;
  verified: boolean;
  vaccinated: boolean;
  type: "sale" | "adoption";
  breed: string;
  recommendation: string;
  sellerId?: string;
  sellerName?: string;
};

type Accessory = {
  id: number;
  name: string;
  priceNum: number;
  priceStr: string;
  image: string;
  category: string;
  speciesTarget: string;
};

const INITIAL_LISTINGS: Listing[] = [
  { id: 1, name: "Golden Retriever", age: "2 Years", price: "₹15,000", location: "Chennai", distance: "2.5 km", image: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=400", verified: true, vaccinated: true, type: "sale", breed: "Golden Retriever", recommendation: "Great with children. Highly trainable.", sellerId: "usr_user1", sellerName: "Alice Green" },
  { id: 2, name: "Persian Cat", age: "1 Year", price: "₹8,000", location: "Madurai", distance: "4 km", image: "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=400", verified: false, vaccinated: true, type: "sale", breed: "Persian", recommendation: "Perfect for apartment living.", sellerId: "usr_user2", sellerName: "Bob Forester" },
  { id: 3, name: "Macaw Parrot", age: "8 Months", price: "₹12,000", location: "Coimbatore", distance: "6 km", image: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400", verified: true, vaccinated: false, type: "sale", breed: "Scarlet Macaw", recommendation: "Highly intelligent and social.", sellerId: "usr_user3", sellerName: "Charlie Eco" },
  { id: 4, name: "Indie Dog (Rescued)", age: "1.5 Years", price: "Free", location: "Chennai", distance: "3 km", image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400", verified: true, vaccinated: true, type: "adoption", breed: "Indian Pariah", recommendation: "Very loyal and low-maintenance.", sellerId: "usr_user1", sellerName: "Alice Green" },
  { id: 5, name: "Mini Rabbit", age: "4 Months", price: "₹3,500", location: "Trichy", distance: "8 km", image: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400", verified: false, vaccinated: false, type: "sale", breed: "Holland Lop", recommendation: "Great starter pet for families.", sellerId: "usr_user2", sellerName: "Bob Forester" },
];

const INITIAL_ACCESSORIES: Accessory[] = [
  { id: 1, name: "Premium Dog Food (5kg)", priceNum: 1200, priceStr: "₹1,200", image: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=300", category: "Food", speciesTarget: "Dog" },
  { id: 10, name: "Adjustable Dumbbell Set (20kg)", priceNum: 4500, priceStr: "₹4,500", image: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=300", category: "Accessories", speciesTarget: "Human" },
  { id: 2, name: "Large Bird Cage & Perch", priceNum: 3500, priceStr: "₹3,500", image: "https://images.unsplash.com/photo-1549737221-bef65e2604a6?w=300", category: "Housing", speciesTarget: "Parrot / Bird" },
  { id: 11, name: "Yoga Mat (Extra Thick)", priceNum: 950, priceStr: "₹950", image: "https://images.unsplash.com/photo-1592432676556-38174f07352b?w=300", category: "Accessories", speciesTarget: "Human" },
  { id: 3, name: "Multi-Level Cat Tree", priceNum: 2800, priceStr: "₹2,800", image: "https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=300", category: "Furniture", speciesTarget: "Cat" },
  { id: 4, name: "Ergonomic Dog Leash Set", priceNum: 850, priceStr: "₹850", image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300", category: "Accessories", speciesTarget: "Dog" },
  { id: 12, name: "Resistance Band Set", priceNum: 1100, priceStr: "₹1,100", image: "https://images.unsplash.com/photo-1598289439248-b1114d499335?w=300", category: "Accessories", speciesTarget: "Human" },
  { id: 5, name: "Emergency Vet Care Kit", priceNum: 1900, priceStr: "₹1,900", image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=300", category: "Health", speciesTarget: "All Animals" },
  { id: 6, name: "Aquarium Tank (60L)", priceNum: 4500, priceStr: "₹4,500", image: "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=300", category: "Housing", speciesTarget: "Fish" },
];

const TABS = [
  { key: "animals", label: "Animals & Adoption", icon: "paw" },
  { key: "accessories", label: "Products & Supplies", icon: "bag" },
  { key: "favorites", label: "Saved & Liked", icon: "heart" },
];

const ACCESSORY_CATS = ["All", "Food", "Housing", "Furniture", "Accessories", "Health"];

export default function MarketplaceScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [listings, setListings] = useState<Listing[]>(INITIAL_LISTINGS);
  const [accessories, setAccessories] = useState<Accessory[]>(INITIAL_ACCESSORIES);
  const [activeTab, setActiveTab] = useState("animals");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Post modal state
  const [postVisible, setPostVisible] = useState(false);
  const [postImage, setPostImage] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postBreed, setPostBreed] = useState("");
  const [postPrice, setPostPrice] = useState("");
  const [postLocation, setPostLocation] = useState("");
  const [postDesc, setPostDesc] = useState("");
  const [postType, setPostType] = useState<"sale" | "adoption" | "accessory">("sale");

  // Cart state
  const [cart, setCart] = useState<{ item: Accessory; qty: number }[]>([]);
  const [cartVisible, setCartVisible] = useState(false);
  const [checkoutDone, setCheckoutDone] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  // Persistence: Load on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("@ecotrack_user_session");
        if (raw) {
          const sess = JSON.parse(raw);
          setUserId(sess.user_id);
          
          // Load cart from backend
          const backendCart = await fetchCart(sess.user_id);
          setCart(backendCart);

          // Load favorites from backend
          const backendFavs = await apiFetchFavorites(sess.user_id);
          setFavorites(backendFavs);
        } else {
          // fallback offline
          const storedCart = await AsyncStorage.getItem("@ecotrack_cart");
          if (storedCart) setCart(JSON.parse(storedCart));

          const storedFavs = await AsyncStorage.getItem("@ecotrack_favorites");
          if (storedFavs) setFavorites(JSON.parse(storedFavs));
        }

        // Load listings from backend
        const backendListings = await apiFetchListings();
        if (backendListings && backendListings.length > 0) {
          const mapped = backendListings.map((item: any) => ({
            id: item.id,
            name: item.title,
            breed: item.breed || "Mixed Breed",
            age: item.age || "Unknown",
            price: item.price === 0 ? "Free" : `₹${item.price.toLocaleString("en-IN")}`,
            location: item.location || "Local",
            distance: "Local",
            image: item.image_url || item.image || "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400",
            verified: item.seller?.verified || true,
            vaccinated: item.vaccinated || true,
            type: item.type === "adoption" ? "adoption" : "sale",
            recommendation: item.description || "Healthy, gentle temperament.",
            sellerId: item.seller?.id || "usr_user1",
            sellerName: item.seller?.name || item.sellerName || "Alice Green"
          }));
          setListings(mapped);
        } else {
          const storedListings = await AsyncStorage.getItem("@ecotrack_listings");
          if (storedListings) setListings(JSON.parse(storedListings));
        }
      } catch (e) {
        console.warn("Error loading marketplace state", e);
      }
    })();
  }, []);

  // Persistence: Save on change
  useEffect(() => {
    if (userId) {
      AsyncStorage.setItem(`@ecotrack_cart_${userId}`, JSON.stringify(cart)).catch(() => {});
    } else {
      AsyncStorage.setItem("@ecotrack_cart", JSON.stringify(cart)).catch(() => {});
    }
  }, [cart, userId]);

  useEffect(() => {
    if (userId) {
      AsyncStorage.setItem(`@ecotrack_favorites_${userId}`, JSON.stringify(favorites)).catch(() => {});
    } else {
      AsyncStorage.setItem("@ecotrack_favorites", JSON.stringify(favorites)).catch(() => {});
    }
  }, [favorites, userId]);

  useEffect(() => {
    if (userId) {
      AsyncStorage.setItem(`@ecotrack_listings_${userId}`, JSON.stringify(listings)).catch(() => {});
    } else {
      AsyncStorage.setItem("@ecotrack_listings", JSON.stringify(listings)).catch(() => {});
    }
  }, [listings, userId]);

  const filteredListings = useMemo(() => {
    let list = listings;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q) || l.breed.toLowerCase().includes(q));
    }
    return list;
  }, [search, listings]);

  const filteredAccessories = useMemo(() => {
    let list = accessories;
    if (selectedCategory !== "All") list = list.filter((a) => a.category === selectedCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.speciesTarget.toLowerCase().includes(q));
    }
    return list;
  }, [selectedCategory, search, accessories]);

  const toggleFav = async (id: number) => {
    setFavorites((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    if (userId) {
      await apiToggleFavorite(userId, id);
    }
  };

  const addToCart = async (item: Accessory) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { item, qty: 1 }];
    });
    if (userId) {
      await apiAddToCart(userId, { id: item.id, name: item.name, price: item.priceNum, priceStr: item.priceStr, category: item.category });
    }
    Toast.show({
      type: 'success',
      text1: '🛒 Added to Cart',
      text2: `${item.name} is ready for checkout.`,
      position: 'bottom',
      bottomOffset: 90
    });
  };

  const removeFromCart = async (id: number) => {
    setCart((prev) => prev.filter((c) => c.item.id !== id));
    if (userId) {
      await apiRemoveFromCart(userId, id);
    }
  };

  const updateCartQty = async (id: number, delta: number) => {
    let updatedCart: { item: Accessory; qty: number }[] = [];
    setCart((prev) => {
      updatedCart = prev
        .map((c) => c.item.id === id ? { ...c, qty: c.qty + delta } : c)
        .filter((c) => c.qty > 0);
      return updatedCart;
    });
    if (userId) {
      setTimeout(async () => {
        await apiUpdateCart(userId, updatedCart);
      }, 0);
    }
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, c) => sum + c.item.priceNum * c.qty, 0);
  }, [cart]);

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!r.canceled) setPostImage(r.assets[0].uri);
  };

  const handlePostItem = async () => {
    if (!postTitle.trim() || !postPrice.trim() || !postLocation.trim()) {
      Alert.alert("Missing Information", "Please enter title, price, and location.");
      return;
    }

    const priceVal = parseFloat(postPrice.replace(/[^0-9.]/g, "")) || 0;
    const listingData = {
      title: postTitle,
      category: postType === "accessory" ? "Accessories" : "Pets",
      price: priceVal,
      location: postLocation,
      image_url: postImage || (postType === "accessory" ? "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=300" : "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400"),
      type: postType === "accessory" ? "accessory" : (postPrice.toLowerCase().includes("free") ? "adoption" : "sale"),
      age: "1 Year",
      breed: postBreed || "Mixed Breed",
      description: postDesc || "Healthy, gentle temperament."
    };

    setPostVisible(false);

    try {
      await apiCreateListing(listingData);
      const backendListings = await apiFetchListings();
      if (backendListings && backendListings.length > 0) {
        const mapped = backendListings.map((item: any) => ({
          id: item.id,
          name: item.title,
          breed: item.breed || "Mixed Breed",
          age: item.age || "Unknown",
          price: item.price === 0 ? "Free" : `₹${item.price.toLocaleString("en-IN")}`,
          location: item.location || "Local",
          distance: "Local",
          image: item.image_url || item.image || "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400",
          verified: item.seller?.verified || true,
          vaccinated: item.vaccinated || true,
          type: item.type === "adoption" ? "adoption" : "sale",
          recommendation: item.description || "Healthy, gentle temperament."
        }));
        setListings(mapped);
      }
    } catch {
      if (postType === "accessory") {
        const newAcc: Accessory = {
          id: Date.now(),
          name: postTitle,
          priceNum: priceVal,
          priceStr: `₹${postPrice}`,
          image: postImage || "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=300",
          category: "Accessories",
          speciesTarget: "General",
        };
        setAccessories((prev) => [newAcc, ...prev]);
      } else {
        const newListing: Listing = {
          id: Date.now(),
          name: postTitle,
          breed: postBreed || "Mixed Breed",
          age: "1 Year",
          price: postPrice.toLowerCase().includes("free") ? "Free" : `₹${postPrice}`,
          location: postLocation,
          distance: "1.0 km",
          image: postImage || "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400",
          type: postType as "sale" | "adoption",
          verified: true,
          vaccinated: true,
          recommendation: postDesc || "Healthy, gentle temperament.",
        };
        setListings((prev) => [newListing, ...prev]);
      }
    }

    Alert.alert("🎉 Success!", `${postTitle} is now live on the EcoTrack marketplace.`);
    setPostTitle(""); setPostBreed(""); setPostPrice(""); setPostLocation(""); setPostDesc(""); setPostImage(null);
    setActiveTab(postType === "accessory" ? "accessories" : postType);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgLight} />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>🛍️ Marketplace</Text>
          <Text style={styles.headerSub} numberOfLines={1}>Verified animal supplies & listings</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => setPostVisible(true)}>
            <Ionicons name="add" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => setCartVisible(true)}>
            <Ionicons name="cart" size={22} color={colors.primary} />
            {cart.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cart.reduce((s, c) => s + c.qty, 0)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? "#fff" : colors.textSecondary}
            />
            <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={activeTab === "accessories" ? "Search pet food, cages, toys..." : "Search breeds, species, locations..."}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ANIMALS & ADOPTION LISTINGS */}
        {activeTab === "animals" && (
          <View style={styles.listGrid}>
            {filteredListings.map((item) => {
              const isFav = favorites.includes(item.id);
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.imageBox}>
                    <Image source={{ uri: item.image }} style={styles.cardImg} />
                    <TouchableOpacity style={styles.favBtn} onPress={() => toggleFav(item.id)}>
                      <Ionicons name={isFav ? "heart" : "heart-outline"} size={18} color={isFav ? colors.danger : "#fff"} />
                    </TouchableOpacity>
                    <View style={styles.cardBadges}>
                      {item.verified && (
                        <View style={styles.verifiedTag}>
                          <Ionicons name="shield-checkmark" size={10} color="#fff" />
                          <Text style={styles.tagText}>Verified</Text>
                        </View>
                      )}
                      <View style={[styles.typeBadge, { backgroundColor: item.type === 'adoption' ? colors.secondary : colors.primary }]}>
                        <Text style={styles.tagText}>{item.type === 'adoption' ? 'Adoption' : 'For Sale'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <Text style={[styles.priceTag, item.price === 'Free' && { color: colors.secondary }]}>{item.price}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}><Ionicons name="paw" size={12} color={colors.textMuted} /><Text style={styles.metaText}>{item.breed}</Text></View>
                      <View style={styles.metaItem}><Ionicons name="time" size={12} color={colors.textMuted} /><Text style={styles.metaText}>{item.age}</Text></View>
                      <View style={styles.metaItem}><Ionicons name="location" size={12} color={colors.textMuted} /><Text style={styles.metaText}>{item.distance}</Text></View>
                    </View>

                    <Text style={styles.recText}>{item.recommendation}</Text>

                    <TouchableOpacity
                      style={styles.contactBtn}
                      onPress={() => router.push(`/chat/${item.sellerId || item.id}?name=${encodeURIComponent(item.sellerName || item.name)}`)}
                    >
                      <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                      <Text style={styles.contactText}>Message Seller</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* PRODUCTS & ACCESSORIES */}
        {activeTab === "accessories" && (
          <View style={{ paddingHorizontal: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {ACCESSORY_CATS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.catChipText, selectedCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.accGrid}>
              {filteredAccessories.map((acc) => {
                const isFav = favorites.includes(acc.id);
                return (
                  <View key={acc.id} style={styles.accCard}>
                    <View style={styles.accImageWrapper}>
                      <Image source={{ uri: acc.image }} style={styles.accImg} />
                      <TouchableOpacity style={styles.favBtn} onPress={() => toggleFav(acc.id)}>
                        <Ionicons name={isFav ? "heart" : "heart-outline"} size={18} color={isFav ? colors.danger : "#fff"} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.accInfo}>
                      <Text style={styles.accCategory}>{acc.category}</Text>
                      <Text style={styles.accName} numberOfLines={1}>{acc.name}</Text>
                      <Text style={styles.accPrice}>{acc.priceStr}</Text>
                      <TouchableOpacity style={styles.addToCartBtn} onPress={() => addToCart(acc)} activeOpacity={0.85}>
                        <Ionicons name="cart-outline" size={14} color="#fff" />
                        <Text style={styles.addToCartBtnText}>Add to Cart</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* SAVED & LIKED FAVORITES */}
        {activeTab === "favorites" && (
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={styles.sectionTitle}>❤️ Saved Animals & Liked Items ({favorites.length})</Text>
            {favorites.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="heart-outline" size={56} color={colors.textMuted} />
                <Text style={styles.emptyText}>No saved items yet.</Text>
                <TouchableOpacity style={styles.continueBtn} onPress={() => setActiveTab("animals")}>
                  <Text style={styles.continueText}>Explore Animals & Products</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.listGrid}>
                {listings.filter(item => favorites.includes(item.id)).map((item) => (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.imageBox}>
                      <Image source={{ uri: item.image }} style={styles.cardImg} />
                      <TouchableOpacity style={styles.favBtn} onPress={() => toggleFav(item.id)}>
                        <Ionicons name="heart" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.cardContent}>
                      <View style={styles.titleRow}>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        <Text style={styles.priceTag}>{item.price}</Text>
                      </View>
                      <Text style={[styles.metaText, { marginTop: 4 }]}>📍 {item.location} • {item.distance}</Text>
                      <TouchableOpacity
                        style={styles.contactBtn}
                        onPress={() => router.push(`/chat/${item.sellerId || item.id}?name=${encodeURIComponent(item.sellerName || item.name)}`)}
                      >
                        <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                        <Text style={styles.contactText}>Message Seller</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {accessories.filter(item => favorites.includes(item.id)).map((acc) => (
                  <View key={acc.id} style={styles.card}>
                    <View style={styles.imageBox}>
                      <Image source={{ uri: acc.image }} style={styles.cardImg} />
                      <TouchableOpacity style={styles.favBtn} onPress={() => toggleFav(acc.id)}>
                        <Ionicons name="heart" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.cardContent}>
                      <View style={styles.titleRow}>
                        <Text style={styles.cardTitle}>{acc.name}</Text>
                        <Text style={styles.priceTag}>{acc.priceStr}</Text>
                      </View>
                      <Text style={[styles.metaText, { marginTop: 4 }]}>🛍️ Category: {acc.category}</Text>
                      <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: colors.primary }]}
                        onPress={() => addToCart(acc)}
                      >
                        <Ionicons name="cart" size={16} color="#fff" />
                        <Text style={styles.contactText}>Add to Cart</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* POST NEW ITEM MODAL */}
      <Modal visible={postVisible} animationType="slide" transparent onRequestClose={() => setPostVisible(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.postCard, { maxHeight: '90%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
            <View style={styles.modalHeader}>
               <Text style={styles.postHeader}>➕ Post Listing</Text>
               <TouchableOpacity onPress={() => setPostVisible(false)}>
                 <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
               </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.postSub}>Publish items locally to EcoTrack network offline.</Text>

              <View style={styles.typeRow}>
                {(["sale", "adoption", "accessory"] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, postType === t && styles.typeBtnActive]}
                    onPress={() => setPostType(t)}
                  >
                    <Text style={[styles.typeText, postType === t && styles.typeTextActive]}>
                      {t === "sale" ? "Sell Animal" : t === "adoption" ? "Free Adoption" : "Product / Supplies"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {postImage ? (
                <View style={styles.previewBox}>
                  <Image source={{ uri: postImage }} style={styles.previewImg} />
                  <TouchableOpacity style={styles.removeImg} onPress={() => setPostImage(null)}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
                  <Ionicons name="camera" size={32} color={colors.primary} />
                  <Text style={styles.uploadText}>Upload Listing Photo</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.label}>Title / Item Name *</Text>
              <TextInput style={styles.input} value={postTitle} onChangeText={setPostTitle} placeholder="e.g. Persian Cat, Dog Food 5kg" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>Breed / Category</Text>
              <TextInput style={styles.input} value={postBreed} onChangeText={setPostBreed} placeholder="e.g. Purebred Persian, Housing" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>Price (₹) *</Text>
              <TextInput style={styles.input} value={postPrice} onChangeText={setPostPrice} keyboardType="numeric" placeholder="e.g. 5000 (Type 'Free' for adoption)" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>Location / City *</Text>
              <TextInput style={styles.input} value={postLocation} onChangeText={setPostLocation} placeholder="e.g. Chennai, Madurai" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, { height: 75 }]} value={postDesc} onChangeText={setPostDesc} placeholder="Describe item, condition, vaccination records..." placeholderTextColor={colors.textMuted} multiline />

              <TouchableOpacity style={styles.submitBtn} onPress={() => { handlePostItem(); setPostVisible(false); }}>
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.submitText}>Publish Listing</Text>
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SHOPPING CART MODAL */}
      <Modal visible={cartVisible} animationType="slide" transparent onRequestClose={() => setCartVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.cartModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🛒 Offline Shopping Cart</Text>
              <TouchableOpacity onPress={() => setCartVisible(false)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="cart-outline" size={64} color={colors.textMuted} />
                <Text style={styles.emptyText}>Your cart is empty</Text>
                <TouchableOpacity style={styles.continueBtn} onPress={() => setCartVisible(false)}>
                   <Text style={styles.continueText}>Continue Shopping</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={styles.orderSummaryHeader}>
                  <Text style={styles.orderSummaryTitle}>Order Summary</Text>
                  <Text style={styles.orderSummaryCount}>{cart.reduce((s, c) => s + c.qty, 0)} Items</Text>
                </View>
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {cart.map(({ item, qty }) => (
                    <View key={item.id} style={styles.cartItemRow}>
                      <Image source={{ uri: item.image }} style={styles.cartThumb} />
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.cartItemName}>{item.name}</Text>
                        <Text style={styles.cartItemPrice}>{item.priceStr}</Text>
                      </View>

                      <View style={styles.cartActions}>
                        <View style={styles.qtyRow}>
                          <TouchableOpacity onPress={() => updateCartQty(item.id, -1)} style={styles.qtyBtn}>
                            <Ionicons name="remove" size={14} color="#fff" />
                          </TouchableOpacity>
                          <Text style={styles.qtyText}>{qty}</Text>
                          <TouchableOpacity onPress={() => updateCartQty(item.id, 1)} style={styles.qtyBtn}>
                            <Ionicons name="add" size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.trashBtn}>
                          <Ionicons name="trash-outline" size={18} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.checkoutFooter}>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Subtotal</Text>
                    <Text style={styles.billVal}>₹{cartTotal.toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Tax & Handling (Simulated)</Text>
                    <Text style={styles.billVal}>₹{(cartTotal * 0.05).toFixed(0)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Grand Total</Text>
                    <Text style={styles.totalVal}>₹{(cartTotal * 1.05).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.checkoutBtn}
                    onPress={() => {
                      if (userId) {
                        apiCheckoutCart(userId, cartTotal * 1.05);
                      }
                      setCheckoutDone(true);
                      setCart([]);
                      setTimeout(() => { setCheckoutDone(false); setCartVisible(false); }, 2000);
                    }}
                  >
                    <Ionicons name="lock-closed" size={18} color="#fff" style={{ marginRight: 10 }} />
                    <Text style={styles.checkoutText}>Secure Checkout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {checkoutDone && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={32} color={colors.success} />
                <Text style={styles.successText}>Order Confirmed! Receipt Saved Offline.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* FLOATING PERSISTENT CART BAR */}
      {cart.length > 0 && (
        <TouchableOpacity style={styles.floatingCartBtn} onPress={() => setCartVisible(true)} activeOpacity={0.9}>
          <View style={styles.floatingCartLeft}>
            <Ionicons name="cart" size={22} color="#fff" />
            <Text style={styles.floatingCartCount}>{cart.reduce((s, c) => s + c.qty, 0)} Items</Text>
          </View>
          <View style={styles.floatingCartRight}>
            <Text style={styles.floatingCartTotal}>₹{cartTotal.toLocaleString("en-IN")}</Text>
            <Text style={styles.floatingCartViewText}>View Cart →</Text>
          </View>
        </TouchableOpacity>
      )}
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
    sectionTitle: { fontSize: FontSize.md, fontWeight: "800", color: colors.textPrimary, marginBottom: 14 },
    headerActionBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: isDark ? colors.bgCard : "#fff", justifyContent: "center", alignItems: "center", position: "relative", borderWidth: 1, borderColor: colors.border, ...Shadow.sm },
    badge: { position: "absolute", top: -4, right: -4, backgroundColor: colors.danger, borderRadius: 10, width: 20, height: 20, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: '#fff' },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

    tabBar: { flexDirection: "row", marginBottom: 16, maxHeight: 48 },
    tabBtn: {
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
    tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabBtnText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: "600" },
    tabBtnTextActive: { color: "#fff", fontWeight: "700" },

    searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: Radius.lg, paddingHorizontal: 14, marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border, height: 44, ...Shadow.sm },
    searchInput: { flex: 1, marginLeft: 8, fontSize: FontSize.sm, color: colors.textPrimary },

    listGrid: { paddingHorizontal: 16, gap: 14 },
    card: { backgroundColor: colors.bgCard, borderRadius: Radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border, ...Shadow.sm },
    imageBox: { height: 200, position: "relative" },
    cardImg: { width: "100%", height: "100%" },
    favBtn: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 16, width: 32, height: 32, justifyContent: "center", alignItems: "center" },
    cardBadges: { position: "absolute", bottom: 12, left: 12, flexDirection: 'row', gap: 6 },
    verifiedTag: { backgroundColor: colors.primary, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 },
    typeBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    tagText: { color: "#fff", fontSize: 9, fontWeight: "800", textTransform: 'uppercase' },

    cardContent: { padding: 16 },
    titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardTitle: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary },
    priceTag: { fontSize: FontSize.lg, fontWeight: "900", color: colors.primary },
    metaRow: { flexDirection: 'row', gap: 12, marginTop: 6, marginBottom: 10 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    recText: { fontSize: FontSize.xs, color: colors.textSecondary, fontStyle: "italic", lineHeight: 18 },
    contactBtn: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 14 },
    contactText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

    catChip: {
      backgroundColor: isDark ? colors.bgCard : "#f3f4f6",
      borderRadius: Radius.full,
      paddingHorizontal: 18,
      paddingVertical: 8,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    catChipText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: "600" },
    catChipTextActive: { color: "#fff", fontWeight: "700" },

    accGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    accCard: { width: (width - 44) / 2, backgroundColor: colors.bgCard, borderRadius: Radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, ...Shadow.sm },
    accImageWrapper: { position: 'relative', height: 130 },
    accImg: { width: "100%", height: "100%" },
    accQuickAdd: { position: 'absolute', bottom: 10, right: 10, backgroundColor: colors.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', ...Shadow.md },
    accInfo: { padding: 12 },
    accCategory: { fontSize: 9, color: colors.textMuted, fontWeight: "800", textTransform: 'uppercase' },
    accName: { fontSize: FontSize.xs, fontWeight: "700", color: colors.textPrimary, marginTop: 4 },
    accPrice: { fontSize: FontSize.md, fontWeight: "800", color: colors.primary, marginTop: 4 },
    addToCartBtn: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
    addToCartBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '800' },

    floatingCartBtn: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: colors.primary, borderRadius: Radius.xl, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...Shadow.lg, zIndex: 99 },
    floatingCartLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    floatingCartCount: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
    floatingCartRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    floatingCartTotal: { color: '#fff', fontWeight: '900', fontSize: FontSize.lg },
    floatingCartViewText: { color: '#fff', fontWeight: '700', fontSize: FontSize.xs },

    postCard: { backgroundColor: colors.bgCard, borderRadius: Radius.xl, padding: 24, borderWidth: 1, borderColor: colors.border, ...Shadow.lg },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    postHeader: { fontSize: FontSize.xl, fontWeight: "800", color: colors.textPrimary },
    postSub: { fontSize: FontSize.sm, color: colors.textSecondary, marginBottom: 16 },
    typeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    typeBtn: { flex: 1, backgroundColor: isDark ? colors.bgLight : "#f3f4f6", borderRadius: Radius.md, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    typeText: { fontSize: 11, color: colors.textSecondary, fontWeight: "700" },
    typeTextActive: { color: "#fff" },
    uploadBox: { height: 140, borderRadius: Radius.lg, borderWidth: 2, borderStyle: "dashed", borderColor: colors.primary, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? colors.bgLight : "#f0fdf4", marginBottom: 16 },
    uploadText: { fontSize: FontSize.sm, fontWeight: "700", color: colors.primary, marginTop: 10 },
    previewBox: { height: 160, borderRadius: Radius.lg, overflow: "hidden", marginBottom: 16, position: "relative" },
    previewImg: { width: "100%", height: "100%" },
    removeImg: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, padding: 6 },
    label: { fontSize: FontSize.xs, fontWeight: "700", color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: isDark ? colors.bgLight : "#f9fafb", borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSize.md, color: colors.textPrimary },
    submitBtn: { backgroundColor: colors.primary, borderRadius: Radius.lg, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 24 },
    submitText: { color: "#fff", fontWeight: "900", fontSize: FontSize.md },

    modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    cartModal: { backgroundColor: colors.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "85%", ...Shadow.lg },
    orderSummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    orderSummaryTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.textPrimary },
    orderSummaryCount: { fontSize: FontSize.xs, color: colors.textMuted, fontWeight: '600' },
    modalTitle: { fontSize: FontSize.xl, fontWeight: "800", color: colors.textPrimary },
    emptyCart: { paddingVertical: 60, alignItems: "center" },
    emptyText: { fontSize: FontSize.md, color: colors.textMuted, marginTop: 16, fontWeight: '600' },
    continueBtn: { marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.full },
    continueText: { color: '#fff', fontWeight: '800' },

    cartItemRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, backgroundColor: isDark ? colors.bgLight : "#f9fafb", padding: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border },
    cartThumb: { width: 60, height: 60, borderRadius: 12 },
    cartItemName: { fontSize: FontSize.sm, fontWeight: "700", color: colors.textPrimary },
    cartItemPrice: { fontSize: FontSize.sm, fontWeight: "800", color: colors.primary, marginTop: 4 },
    cartActions: { alignItems: 'flex-end', gap: 10 },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.primary, borderRadius: Radius.full, paddingHorizontal: 4, paddingVertical: 4 },
    qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: "center", alignItems: "center" },
    qtyText: { fontSize: FontSize.sm, fontWeight: "900", color: "#fff", minWidth: 20, textAlign: 'center' },
    trashBtn: { padding: 4 },

    checkoutFooter: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20, marginTop: 10 },
    billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    billLabel: { fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: '600' },
    billVal: { fontSize: FontSize.xs, color: colors.textPrimary, fontWeight: '700' },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 20 },
    totalLabel: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary },
    totalVal: { fontSize: FontSize.xl, fontWeight: "900", color: colors.primary },
    checkoutBtn: { backgroundColor: colors.success, borderRadius: Radius.lg, paddingVertical: 16, alignItems: "center", ...Shadow.md },
    checkoutText: { color: "#fff", fontWeight: "900", fontSize: FontSize.md },
    successBanner: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bgCard, justifyContent: "center", alignItems: "center", borderRadius: Radius.xl, zIndex: 100 },
    successText: { fontSize: FontSize.lg, fontWeight: "800", color: colors.success, marginTop: 14, textAlign: 'center', paddingHorizontal: 40 },
  });
}
