import { Link } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useStore } from '../store/useStore';
import { useTableland } from '../hooks/useTableland';
import { useEffect, useState } from 'react';
import type { Meal } from '@cloe/types';

export default function Dashboard() {
  const { user: localUser, getDailyStats, setUser } = useStore();
  const { tablelandService, isConnected, isInitializing, userTable, userProfile } = useTableland();
  const [web3Meals, setWeb3Meals] = useState<Meal[]>([]);
  const [isLoadingMeals, setIsLoadingMeals] = useState(false);
  
  // Use web3 profile if connected, otherwise use local profile
  const user = isConnected && userProfile ? userProfile : localUser;
  
  // Sync web3 profile with store when connected
  useEffect(() => {
    if (isConnected && userProfile) {
      setUser(userProfile);
    } else if (!isConnected) {
      setUser(localUser);
    }
  }, [isConnected, userProfile, setUser, localUser]);
  
  useEffect(() => {
    async function loadMeals() {
      if (!tablelandService || !userTable) return;
      
      setIsLoadingMeals(true);
      try {
        const meals = await tablelandService.getTodayMeals();
        setWeb3Meals(meals);
      } catch (error) {
        console.error('Failed to load meals:', error);
      } finally {
        setIsLoadingMeals(false);
      }
    }
    
    loadMeals();
  }, [tablelandService, userTable]);

  const dailyStats = getDailyStats();
  
  // Calculate stats including web3 meals
  const totalCaloriesFromWeb3 = web3Meals.reduce((sum, meal) => sum + meal.totalNutrition.calories, 0);
  const totalCarbsFromWeb3 = web3Meals.reduce((sum, meal) => sum + meal.totalNutrition.carbs, 0);
  const totalFatsFromWeb3 = web3Meals.reduce((sum, meal) => sum + meal.totalNutrition.fats, 0);
  const totalProteinsFromWeb3 = web3Meals.reduce((sum, meal) => sum + meal.totalNutrition.proteins, 0);

  if (!user || !dailyStats) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white">
                🦝
              </div>
              <h1 className="text-xl font-semibold">Hi {user.name}!</h1>
            </div>
          </div>
          
          {/* Wallet Connection */}
          <div className="flex flex-col items-center gap-2">
            <ConnectButton />
            {isConnected && userProfile && (
              <div className="text-center">
                <div className="text-xs text-gray-500">
                  Profile stored on-chain ✅
                </div>
                <div className="text-xs text-gray-400">
                  Meals: {userTable}
                </div>
              </div>
            )}
            {isInitializing && (
              <div className="text-sm text-purple-600">
                Setting up your Web3 profile...
              </div>
            )}
          </div>
        </div>

        {/* Calorie Summary Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-purple-600 mb-2">
              {user.dailyCalorieTarget - (dailyStats.totalCalories + totalCaloriesFromWeb3)}
            </div>
            <div className="text-gray-500">kcal left</div>
          </div>

          <div className="flex justify-around">
            <div className="text-center">
              <div className="text-2xl font-semibold">{dailyStats.totalMacros.carbs + totalCarbsFromWeb3}g</div>
              <div className="text-sm text-gray-500">Carbs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">{dailyStats.totalMacros.fats + totalFatsFromWeb3}g</div>
              <div className="text-sm text-gray-500">Fats</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">{dailyStats.totalMacros.proteins + totalProteinsFromWeb3}g</div>
              <div className="text-sm text-gray-500">Proteins</div>
            </div>
          </div>
        </div>

        {/* Recent Meals */}
        <div className="mb-20">
          <h2 className="text-lg font-semibold mb-4">Today's Meals</h2>
          
          {isConnected && !userTable && !isInitializing && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-yellow-800">
                Creating your Tableland table...
              </p>
            </div>
          )}
          
          {isLoadingMeals && (
            <div className="bg-white rounded-xl p-6 text-center text-gray-500">
              Loading meals from blockchain...
            </div>
          )}
          
          {!isLoadingMeals && (dailyStats.meals.length === 0 && web3Meals.length === 0) ? (
            <div className="bg-white rounded-xl p-6 text-center text-gray-500">
              No meals logged yet today
            </div>
          ) : (
            <div className="space-y-3">
              {/* Show web3 meals */}
              {web3Meals.map((meal) => (
                <div key={meal.id} className="bg-white rounded-xl p-4 shadow-sm border-2 border-purple-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium capitalize">{meal.type}</h3>
                      <p className="text-sm text-gray-500">
                        {meal.items.map(item => item.name).join(', ')}
                      </p>
                      <span className="text-xs text-purple-600">🔗 On-chain</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{meal.totalNutrition.calories} kcal</div>
                      <div className="text-xs text-gray-500">
                        {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Show local meals */}
              {dailyStats.meals.map((meal) => (
                <div key={meal.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium capitalize">{meal.type}</h3>
                      <p className="text-sm text-gray-500">
                        {meal.items.map(item => item.name).join(', ')}
                      </p>
                      <span className="text-xs text-gray-400">📱 Local</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{meal.totalNutrition.calories} kcal</div>
                      <div className="text-xs text-gray-500">
                        {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Button */}
        <div className="fixed bottom-6 left-0 right-0 max-w-md mx-auto px-4">
          <Link 
            to="/add-meal"
            className="w-full bg-purple-600 text-white rounded-full py-4 flex items-center justify-center font-medium hover:bg-purple-700 transition shadow-lg"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Meal
          </Link>
        </div>
      </div>
    </div>
  );
}