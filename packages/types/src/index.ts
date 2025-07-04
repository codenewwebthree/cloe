export interface User {
  id: string;
  name: string;
  email: string;
  dailyCalorieTarget: number;
  dailyMacroTargets: {
    carbs: number;
    fats: number;
    proteins: number;
  };
}

export interface NutritionInfo {
  calories: number;
  carbs: number;
  fats: number;
  proteins: number;
}

export interface FoodItem {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  carbs: number;
  fats: number;
  proteins: number;
}

export interface Meal {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: FoodItem[];
  totalNutrition: NutritionInfo;
  imageUrl?: string;
}

export interface DailyStats {
  date: Date;
  totalCalories: number;
  totalMacros: NutritionInfo;
  remainingCalories: number;
  remainingMacros: {
    carbs: number;
    fats: number;
    proteins: number;
  };
  meals: Meal[];
}