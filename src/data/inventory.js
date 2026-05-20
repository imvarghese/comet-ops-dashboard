export const STORES = [
  { id: 'indiranagar', name: 'Indiranagar', city: 'Bangalore', manager: 'Priya S.' },
  { id: 'vasant-vihar', name: 'Vasant Vihar', city: 'New Delhi', manager: 'Neha K.' },
  { id: 'navrangpura', name: 'Navrangpura', city: 'Ahmedabad', manager: 'Arjun M.' },
  { id: 'lakeshore', name: 'Lakeshore Mall', city: 'Hyderabad', manager: 'Rahul V.' },
  { id: 'sarath-city', name: 'Sarath City', city: 'Hyderabad', manager: 'Kavya R.' },
]

export const WAREHOUSE = { id: 'warehouse', name: 'Central Warehouse', city: 'Bangalore' }

export const SKUS = [
  { id: 'madagascar', name: 'Madagascar', colorway: 'Forest Green / Cream', rrp: 4299, leadTimeDays: 10 },
  { id: 'mango-chilli', name: 'Mango Chilli', colorway: 'Burnt Orange / Red', rrp: 4899, leadTimeDays: 10 },
  { id: 'chestnut', name: 'Chestnut', colorway: 'Brown / Tan', rrp: 4299, leadTimeDays: 14 },
  { id: 'neptune', name: 'Neptune', colorway: 'Navy / Off-White', rrp: 4299, leadTimeDays: 12 },
  { id: 'saffron', name: 'Apex Cyberpunk', colorway: 'Turmeric / White', rrp: 6299, leadTimeDays: 10 },
]

export const SIZES = ['UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11']

// stock[storeId][skuId][size] = units on hand
export const STOCK = {
  indiranagar: {
    madagascar:     { UK6: 2, UK7: 3, UK8: 1, UK9: 0, UK10: 2, UK11: 1 },
    'mango-chilli': { UK6: 0, UK7: 2, UK8: 3, UK9: 4, UK10: 1, UK11: 0 },
    chestnut:       { UK6: 1, UK7: 4, UK8: 5, UK9: 3, UK10: 2, UK11: 1 },
    neptune:        { UK6: 0, UK7: 0, UK8: 0, UK9: 0, UK10: 0, UK11: 0 },
    saffron:        { UK6: 3, UK7: 5, UK8: 4, UK9: 3, UK10: 2, UK11: 1 },
  },
  'vasant-vihar': {
    madagascar:     { UK6: 4, UK7: 6, UK8: 8, UK9: 5, UK10: 3, UK11: 2 },
    'mango-chilli': { UK6: 1, UK7: 2, UK8: 3, UK9: 2, UK10: 1, UK11: 0 },
    chestnut:       { UK6: 2, UK7: 3, UK8: 4, UK9: 3, UK10: 2, UK11: 1 },
    neptune:        { UK6: 1, UK7: 2, UK8: 3, UK9: 2, UK10: 1, UK11: 1 },
    saffron:        { UK6: 0, UK7: 1, UK8: 1, UK9: 0, UK10: 0, UK11: 0 },
  },
  navrangpura: {
    madagascar:     { UK6: 1, UK7: 2, UK8: 3, UK9: 2, UK10: 1, UK11: 0 },
    'mango-chilli': { UK6: 3, UK7: 5, UK8: 6, UK9: 4, UK10: 2, UK11: 1 },
    chestnut:       { UK6: 1, UK7: 2, UK8: 3, UK9: 2, UK10: 1, UK11: 0 },
    neptune:        { UK6: 2, UK7: 3, UK8: 4, UK9: 3, UK10: 2, UK11: 1 },
    saffron:        { UK6: 2, UK7: 4, UK8: 5, UK9: 3, UK10: 2, UK11: 1 },
  },
  lakeshore: {
    madagascar:     { UK6: 0, UK7: 1, UK8: 2, UK9: 1, UK10: 0, UK11: 0 },
    'mango-chilli': { UK6: 2, UK7: 3, UK8: 4, UK9: 3, UK10: 1, UK11: 0 },
    chestnut:       { UK6: 3, UK7: 5, UK8: 6, UK9: 4, UK10: 2, UK11: 1 },
    neptune:        { UK6: 1, UK7: 2, UK8: 3, UK9: 2, UK10: 1, UK11: 0 },
    saffron:        { UK6: 1, UK7: 2, UK8: 3, UK9: 2, UK10: 1, UK11: 0 },
  },
  'sarath-city': {
    madagascar:     { UK6: 1, UK7: 2, UK8: 4, UK9: 3, UK10: 1, UK11: 0 },
    'mango-chilli': { UK6: 2, UK7: 3, UK8: 5, UK9: 2, UK10: 1, UK11: 1 },
    chestnut:       { UK6: 0, UK7: 1, UK8: 2, UK9: 1, UK10: 0, UK11: 0 },
    neptune:        { UK6: 3, UK7: 4, UK8: 6, UK9: 5, UK10: 3, UK11: 2 },
    saffron:        { UK6: 1, UK7: 2, UK8: 3, UK9: 2, UK10: 1, UK11: 0 },
  },
  warehouse: {
    madagascar:     { UK6: 8, UK7: 12, UK8: 10, UK9: 6, UK10: 8, UK11: 4 },
    'mango-chilli': { UK6: 5, UK7: 8,  UK8: 10, UK9: 7, UK10: 5, UK11: 3 },
    chestnut:       { UK6: 4, UK7: 6,  UK8: 8,  UK9: 5, UK10: 3, UK11: 2 },
    neptune:        { UK6: 6, UK7: 10, UK8: 12, UK9: 8, UK10: 6, UK11: 4 },
    saffron:        { UK6: 10, UK7: 15, UK8: 18, UK9: 12, UK10: 8, UK11: 5 },
  },
}

// Weekly units sold, last 4 weeks: [oldest → most recent]
export const WEEKLY_MOVEMENT = {
  indiranagar: {
    madagascar:     [4, 5, 6, 7],
    'mango-chilli': [3, 3, 4, 5],
    chestnut:       [2, 3, 3, 2],
    neptune:        [5, 6, 7, 8],
    saffron:        [2, 2, 3, 2],
  },
  'vasant-vihar': {
    madagascar:     [1, 1, 2, 1],
    'mango-chilli': [2, 2, 3, 3],
    chestnut:       [1, 2, 2, 1],
    neptune:        [1, 1, 2, 1],
    saffron:        [3, 4, 5, 6],
  },
  navrangpura: {
    madagascar:     [2, 2, 3, 2],
    'mango-chilli': [1, 2, 2, 2],
    chestnut:       [2, 3, 3, 2],
    neptune:        [1, 1, 2, 1],
    saffron:        [1, 2, 2, 1],
  },
  lakeshore: {
    madagascar:     [3, 4, 4, 5],
    'mango-chilli': [1, 1, 2, 1],
    chestnut:       [1, 1, 1, 2],
    neptune:        [1, 2, 2, 1],
    saffron:        [1, 1, 2, 1],
  },
  'sarath-city': {
    madagascar:     [3, 4, 4, 5],
    'mango-chilli': [2, 3, 4, 3],
    chestnut:       [4, 5, 6, 7],
    neptune:        [1, 2, 2, 1],
    saffron:        [2, 3, 3, 4],
  },
}
