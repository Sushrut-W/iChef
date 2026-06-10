// Common-ingredient list for pantry autocomplete. Local and free — replaces
// the Spoonacular autocomplete endpoint, which cost ~1 quota point per call.

export const COMMON_INGREDIENTS = [
  // Produce
  'apple', 'avocado', 'banana', 'basil', 'beet', 'bell pepper', 'blueberries', 'bok choy',
  'broccoli', 'brussels sprouts', 'butternut squash', 'cabbage', 'carrot', 'cauliflower',
  'celery', 'cherry tomatoes', 'cilantro', 'corn', 'cucumber', 'eggplant', 'garlic', 'ginger',
  'grapes', 'green beans', 'green onion', 'jalapeno', 'kale', 'leek', 'lemon', 'lettuce',
  'lime', 'mango', 'mint', 'mushrooms', 'onion', 'orange', 'parsley', 'peas', 'pineapple',
  'potato', 'pumpkin', 'radish', 'raspberries', 'red onion', 'rosemary', 'shallot', 'spinach',
  'strawberries', 'sweet potato', 'thyme', 'tomato', 'zucchini',
  // Dairy & eggs
  'butter', 'buttermilk', 'cheddar cheese', 'cottage cheese', 'cream', 'cream cheese',
  'eggs', 'feta cheese', 'goat cheese', 'greek yogurt', 'half and half', 'heavy cream',
  'milk', 'mozzarella', 'parmesan', 'ricotta', 'sour cream', 'swiss cheese', 'whipping cream',
  'yogurt',
  // Meat & seafood
  'bacon', 'beef', 'chicken breast', 'chicken thighs', 'chicken wings', 'chorizo', 'cod',
  'crab', 'ground beef', 'ground chicken', 'ground pork', 'ground turkey', 'ham', 'lamb',
  'pepperoni', 'pork chops', 'pork loin', 'prosciutto', 'salami', 'salmon', 'sausage',
  'shrimp', 'sirloin steak', 'tilapia', 'tuna', 'turkey',
  // Pantry
  'almonds', 'baguette', 'basmati rice', 'black beans', 'bread', 'breadcrumbs', 'broth',
  'brown rice', 'cashews', 'cereal', 'chia seeds', 'chickpeas', 'chicken broth', 'coconut milk',
  'couscous', 'crackers', 'dried cranberries', 'egg noodles', 'jasmine rice', 'kidney beans',
  'lasagna noodles', 'lentils', 'macaroni', 'oats', 'olives', 'orzo', 'panko', 'pasta',
  'peanut butter', 'peanuts', 'pecans', 'penne', 'pinto beans', 'pita bread', 'quinoa',
  'raisins', 'ramen noodles', 'rice', 'rice noodles', 'spaghetti', 'sun dried tomatoes',
  'tofu', 'tomato paste', 'tomato sauce', 'tortilla chips', 'tortillas', 'vegetable broth',
  'walnuts', 'white rice',
  // Baking
  'active dry yeast', 'all purpose flour', 'almond flour', 'baking powder', 'baking soda',
  'bread flour', 'brown sugar', 'chocolate chips', 'cocoa powder', 'condensed milk',
  'cornmeal', 'cornstarch', 'evaporated milk', 'flour', 'granulated sugar', 'honey',
  'maple syrup', 'molasses', 'powdered sugar', 'sugar', 'vanilla extract', 'whole wheat flour',
  // Spices & seasoning
  'allspice', 'basil dried', 'bay leaves', 'black pepper', 'cajun seasoning', 'cardamom',
  'cayenne pepper', 'chili flakes', 'chili powder', 'cinnamon', 'cloves', 'coriander',
  'cumin', 'curry powder', 'dill', 'fennel seeds', 'five spice', 'garam masala',
  'garlic powder', 'ground ginger', 'italian seasoning', 'nutmeg', 'onion powder', 'oregano',
  'paprika', 'red pepper flakes', 'saffron', 'sage', 'salt', 'smoked paprika', 'turmeric',
  'white pepper',
  // Condiments & oils
  'apple cider vinegar', 'balsamic vinegar', 'bbq sauce', 'canola oil', 'coconut oil',
  'dijon mustard', 'fish sauce', 'hoisin sauce', 'hot sauce', 'hummus', 'ketchup',
  'mayonnaise', 'mirin', 'miso paste', 'mustard', 'olive oil', 'oyster sauce', 'pesto',
  'ranch dressing', 'red wine vinegar', 'rice vinegar', 'salsa', 'sesame oil', 'soy sauce',
  'sriracha', 'tahini', 'teriyaki sauce', 'vegetable oil', 'vinegar', 'worcestershire sauce',
  // Frozen
  'frozen berries', 'frozen corn', 'frozen peas', 'frozen pizza', 'frozen shrimp',
  'frozen spinach', 'ice cream', 'puff pastry',
  // Beverages
  'apple juice', 'beer', 'coffee', 'orange juice', 'red wine', 'sparkling water', 'tea',
  'white wine',
];

export function suggestIngredients(query, limit = 8) {
  const q = String(query || '').toLowerCase().trim();
  if (q.length < 2) return [];
  const starts = [];
  const contains = [];
  for (const name of COMMON_INGREDIENTS) {
    if (name.startsWith(q)) starts.push(name);
    else if (name.includes(q)) contains.push(name);
  }
  return [...starts, ...contains].slice(0, limit);
}
