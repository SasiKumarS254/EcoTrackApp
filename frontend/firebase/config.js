import { initializeApp } from "firebase/app";

import {
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getFirestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
  authDomain: "ecotrack-3de2e.firebaseapp.com",
  projectId: "ecotrack-3de2e",
  storageBucket: "ecotrack-3de2e.firebasestorage.app",
  messagingSenderId: "168601478515",
  appId: "1:168601478515:web:3f6e1e4de60cd325ca1106",
  measurementId: "G-MHVQ75VV56"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence:
    getReactNativePersistence(
      AsyncStorage
    ),
});

export const db = getFirestore(app);

export default app;