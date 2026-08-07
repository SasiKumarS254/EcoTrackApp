export const posts = [

  {
    id: 1,

    user: "Wildlife Explorer",

    avatar:
      "https://randomuser.me/api/portraits/men/32.jpg",

    image:
      "https://images.unsplash.com/photo-1546182990-dffeafbe841d",

    caption:
      "Amazing wildlife experience in the forest 🌿",

    likes: 245,

    comments: 18,

    time: "2h ago",
  },

  {
    id: 2,

    user: "Animal Lover",

    avatar:
      "https://randomuser.me/api/portraits/women/44.jpg",

    image:
      "https://images.unsplash.com/photo-1474511320723-9a56873867b5",

    caption:
      "Protect animals and nature 🐾",

    likes: 532,

    comments: 41,

    time: "5h ago",
  },

];

export const addPost = (post) => {

  posts.unshift({

    id: Date.now(),

    avatar:
      "https://randomuser.me/api/portraits/men/11.jpg",

    comments: 0,

    time: "Just now",

    ...post,
  });
};