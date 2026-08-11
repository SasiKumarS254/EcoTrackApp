let events = [

  {
    id: 1,
    title: "Wildlife Rescue Camp",
    date: "20 May 2026",
    location: "Chennai",
    image:
      "https://images.unsplash.com/photo-1546182990-dffeafbe841d",
    description:
      "Join wildlife experts and rescue injured animals.",
  },

  {
    id: 2,
    title: "International Dog Exhibition",
    date: "28 May 2026",
    location: "Bangalore",
    image:
      "https://images.unsplash.com/photo-1517849845537-4d257902454a",
    description:
      "Showcase dog breeds and participate in competitions.",
  },

];

export const getEvents = () => {
  return events;
};

export const addEvent = (event) => {

  events.unshift({
    id: Date.now(),
    ...event,
  });

};