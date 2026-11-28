/**
 * Home Decor catalogue for the player's expanded Maple Lane house.
 * Purchased items appear immediately in 3D inside the house and persist in saves.
 */

export const HOME_DECOR_ITEMS = [
  {
    id: 'living-rug',
    name: 'Woven Living Rug',
    room: 'Living Room',
    price: 25,
    icon: '🧶',
    description: 'Warm terracotta and cream woven area rug centered in your living room.'
  },
  {
    id: 'fiddle-plant',
    name: 'Potted Fiddle Fig',
    room: 'Living Room',
    price: 20,
    icon: '🪴',
    description: 'A lush indoor fig tree in a stoneware pot for the sunny front corner.'
  },
  {
    id: 'brass-lamp',
    name: 'Brass Floor Lamp',
    room: 'Living Room',
    price: 35,
    icon: '💡',
    description: 'Brushed-brass mid-century floor lamp with a warm glowing shade beside your sofa.'
  },
  {
    id: 'valley-art',
    name: 'Valley Landscape Art',
    room: 'Living Room',
    price: 30,
    icon: '🖼️',
    description: 'Walnut-framed painting of Maple Valley hung above your living-room sofa.'
  },
  {
    id: 'walnut-bookshelf',
    name: 'Walnut Bookshelf',
    room: 'Living Room',
    price: 45,
    icon: '📚',
    description: 'Hand-crafted bookshelf stocked with books and vinyl records along the front wall.'
  },
  {
    id: 'bedroom-lamp',
    name: 'Bedside Lamp & Fern',
    room: 'Bedroom',
    price: 28,
    icon: '🛋️',
    description: 'Warm linen bedside lamp and potted fern to make the bedroom feel like home.'
  }
];

export function getHomeDecorItem(id) {
  return HOME_DECOR_ITEMS.find((item) => item.id === id) || null;
}
