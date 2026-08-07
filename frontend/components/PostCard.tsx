import React, { useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";

import Ionicons from
  "@expo/vector-icons/Ionicons";

interface PostType {
  id: number;
  user: string;
  avatar: string;
  image: string;
  caption: string;
  likes: number;
  comments: number;
  time: string;
}

interface Props {
  post: PostType;
}

export default function PostCard({
  post,
}: Props) {

  const [likes, setLikes] =
    useState(post.likes);

  const [liked, setLiked] =
    useState(false);

  const handleLike = () => {

    if (liked) {
      setLikes(likes - 1);
    } else {
      setLikes(likes + 1);
    }

    setLiked(!liked);
  };

  return (

    <View style={styles.card}>

      {/* HEADER */}
      <View style={styles.header}>

        <Image
          source={{
            uri: post.avatar,
          }}
          style={styles.avatar}
        />

        <View>

          <Text style={styles.user}>
            {post.user}
          </Text>

          <Text style={styles.time}>
            {post.time}
          </Text>

        </View>

      </View>

      {/* IMAGE */}
      <Image
        source={{
          uri: post.image,
        }}
        style={styles.postImage}
      />

      {/* ACTIONS */}
      <View style={styles.actions}>

        <TouchableOpacity
          onPress={handleLike}
        >

          <Ionicons
            name={
              liked
                ? "heart"
                : "heart-outline"
            }
            size={30}
            color={
              liked
                ? "red"
                : "black"
            }
          />

        </TouchableOpacity>

        <TouchableOpacity>

          <Ionicons
            name="chatbubble-outline"
            size={28}
            color="black"
          />

        </TouchableOpacity>

      </View>

      {/* INFO */}
      <Text style={styles.likes}>
        {likes} likes
      </Text>

      <Text style={styles.caption}>
        <Text style={styles.bold}>
          {post.user}
        </Text>
        {" "}
        {post.caption}
      </Text>

      <Text style={styles.comments}>
        View all {post.comments} comments
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({

  card: {
    backgroundColor: "white",
    marginBottom: 24,
    borderRadius: 24,
    overflow: "hidden",
    elevation: 4,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },

  user: {
    fontSize: 17,
    fontWeight: "bold",
  },

  time: {
    color: "gray",
    marginTop: 3,
  },

  postImage: {
    width: "100%",
    height: 320,
  },

  actions: {
    flexDirection: "row",
    gap: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  likes: {
    fontWeight: "bold",
    fontSize: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  caption: {
    paddingHorizontal: 16,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 8,
  },

  bold: {
    fontWeight: "bold",
  },

  comments: {
    color: "gray",
    paddingHorizontal: 16,
    marginBottom: 16,
  },

});