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
  },
  {
    id: 'pet-bed',
    name: 'Cozy Pet Bed',
    room: 'Living Room',
    price: 22,
    icon: '🐾',
    description: 'Plush sage-and-cream cushion where Maple curls up to nap indoors.'
  },
  {
    id: 'string-lights',
    name: 'Warm String Lights',
    room: 'Living Room',
    price: 18,
    icon: '✨',
    description: 'Soft golden fairy lights draped across your living room wall for evening glow.'
  },
  {
    id: 'coffee-bar',
    name: 'Kitchen Espresso Corner',
    room: 'Kitchen',
    price: 38,
    icon: '☕',
    description: 'Compact brushed-steel espresso machine and ceramic mugs for your kitchen counter.'
  }
];

export const HOME_THEMES = Object.freeze([
  { id: 'classic', name: 'Classic', swatch: '#dfd5c3', tint: 0xffffff },
  { id: 'sage', name: 'Valley Sage', swatch: '#9db49e', tint: 0xe3efe2 },
  { id: 'cabin', name: 'Autumn Cabin', swatch: '#cfa476', tint: 0xf7e7d2 },
  { id: 'coastal', name: 'Misty Morning', swatch: '#9eb6cc', tint: 0xe2ecf7 }
]);

export function getHomeDecorItem(id) {
  return HOME_DECOR_ITEMS.find((item) => item.id === id) || null;
}

export function getHomeTheme(id) {
  return HOME_THEMES.find((t) => t.id === id) || HOME_THEMES[0];
}
