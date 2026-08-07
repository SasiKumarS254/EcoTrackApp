import React, { useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";

import { router } from "expo-router";

import { supabase } from
"../lib/supabase";

export default function AuthScreen() {

  const [isLogin, setIsLogin] =
    useState(true);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const handleAuth =
    async () => {

      if (!email || !password) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;
      }

      if (isLogin) {

        const { error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (error) {

          Alert.alert(
            "Login Failed",
            error.message
          );

          return;
        }

        Alert.alert(
          "Success",
          "Login Successful"
        );

      } else {

        const { error } =
          await supabase.auth.signUp({
            email,
            password,
          });

        if (error) {

          Alert.alert(
            "Signup Failed",
            error.message
          );

          return;
        }

        Alert.alert(
          "Success",
          "Account Created"
        );
      }

      router.replace("/(tabs)");
    };

  return (

    <View style={styles.container}>

      <Text style={styles.title}>

        {isLogin
          ? "🔐 Login"
          : "📝 Create Account"}

      </Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="gray"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="gray"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleAuth}
      >

        <Text style={styles.buttonText}>

          {isLogin
            ? "Login"
            : "Create Account"}

        </Text>

      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          setIsLogin(!isLogin)
        }
      >

        <Text style={styles.link}>

          {isLogin
            ? "Create New Account"
            : "Already have account?"}

        </Text>

      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f4fff4",
  },

  title: {
    fontSize: 34,
    fontWeight: "bold",
    color: "green",
    marginBottom: 40,
    textAlign: "center",
  },

  input: {
    backgroundColor: "white",
    height: 60,
    borderRadius: 18,
    paddingHorizontal: 18,
    marginBottom: 20,
    fontSize: 16,
  },

  button: {
    backgroundColor: "green",
    height: 60,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },

  link: {
    textAlign: "center",
    marginTop: 24,
    color: "#1565c0",
    fontWeight: "bold",
  },

});