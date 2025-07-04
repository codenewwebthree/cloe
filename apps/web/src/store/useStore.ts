import { create } from 'zustand';
import type { User, Meal, DailyStats } from '@cloe/types';

interface AppState {
  user: User | null;
  meals: Meal[]; // Local meals only (for non-web3 users)
  currentDate: Date;
  
  setUser: (user: User | null) => void;
  addMeal: (meal: Meal) => void;
  setMeals: (meals: Meal[]) => void;
  getDailyStats: () => DailyStats | null;
}

export const useStore = create<AppState>((set, get) => ({
  // Default user for non-web3 users
  user: {
    id: 'local-user',
    name: 'Guest User',
    email: 'guest@example.com',
    dailyCalorieTarget: 2000,
    dailyMacroTargets: {
      carbs: 250,
      fats: 65,
      proteins: 150
    }
  },
  meals: [],
  currentDate: new Date(),

  setUser: (user) => set({ user }),
  
  addMeal: (meal) => set((state) => ({
    meals: [...state.meals, meal]
  })),
  
  setMeals: (meals) => set({ meals }),

  getDailyStats: () => {
    const state = get();
    if (!state.user) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayMeals = state.meals.filter(meal => {
      const mealDate = new Date(meal.timestamp);
      mealDate.setHours(0, 0, 0, 0);
      return mealDate.getTime() === today.getTime();
    });

    const totalCalories = todayMeals.reduce((sum, meal) => sum + meal.totalNutrition.calories, 0);
    const totalCarbs = todayMeals.reduce((sum, meal) => sum + meal.totalNutrition.carbs, 0);
    const totalFats = todayMeals.reduce((sum, meal) => sum + meal.totalNutrition.fats, 0);
    const totalProteins = todayMeals.reduce((sum, meal) => sum + meal.totalNutrition.proteins, 0);

    return {
      date: today,
      totalCalories,
      totalMacros: {
        calories: totalCalories,
        carbs: totalCarbs,
        fats: totalFats,
        proteins: totalProteins
      },
      remainingCalories: state.user.dailyCalorieTarget - totalCalories,
      remainingMacros: {
        carbs: state.user.dailyMacroTargets.carbs - totalCarbs,
        fats: state.user.dailyMacroTargets.fats - totalFats,
        proteins: state.user.dailyMacroTargets.proteins - totalProteins
      },
      meals: todayMeals
    };
  }
}));