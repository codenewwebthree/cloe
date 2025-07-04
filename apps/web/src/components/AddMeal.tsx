import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { DecentralizedAIService } from '@cloe/lit-ai';
import { useStore } from '../store/useStore';
import { useTableland } from '../hooks/useTableland';
import type { FoodItem, Meal } from '@cloe/types';

export default function AddMeal() {
  const navigate = useNavigate();
  const addMeal = useStore((state) => state.addMeal);
  const { tablelandService, isConnected, userTable } = useTableland();
  const [isCapturing, setIsCapturing] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [aiService, setAiService] = useState<DecentralizedAIService | null>(null);
  const [analysisMetadata, setAnalysisMetadata] = useState<{
    providersUsed?: number;
    confidence?: string;
    network?: string;
  }>({});
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize decentralized AI service
  useEffect(() => {
    const initAI = async () => {
      try {
        const service = new DecentralizedAIService();
        await service.initialize();
        setAiService(service);
      } catch (error) {
        console.error('Failed to initialize decentralized AI:', error);
        setError('Failed to initialize AI service. Using fallback mode.');
      }
    };
    
    initAI();
    
    return () => {
      if (aiService) {
        aiService.disconnect();
      }
    };
  }, []);

  const captureImage = useCallback(async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const base64 = imageSrc.split(',')[1];
        await analyzeImage(base64);
      }
    }
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result?.toString().split(',')[1];
        if (base64) {
          await analyzeImage(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    setIsCapturing(false);
    setError(null);

    try {
      const apiKey = localStorage.getItem('openrouter_api_key');
      if (!apiKey) {
        throw new Error('OpenRouter API key not found');
      }

      let result;
      
      if (aiService) {
        // Use decentralized AI service
        try {
          result = await aiService.analyzeFood(base64, apiKey);
          setAnalysisMetadata({
            providersUsed: result.providersUsed,
            confidence: result.confidence,
            network: result.network
          });
        } catch (litError) {
          console.warn('Lit Protocol analysis failed, using fallback:', litError);
          result = await aiService.analyzeFoodFallback(base64, apiKey);
          setAnalysisMetadata({
            providersUsed: 1,
            confidence: 'low',
            network: 'centralized-fallback'
          });
        }
      } else {
        // Direct fallback if service not initialized
        throw new Error('AI service not available');
      }

      setFoodItems(result.items);
    } catch (err) {
      setError('Failed to analyze image. Please try again.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateFoodItem = (index: number, field: keyof FoodItem, value: any) => {
    const updated = [...foodItems];
    updated[index] = { ...updated[index], [field]: value };
    setFoodItems(updated);
  };

  const removeFoodItem = (index: number) => {
    setFoodItems(foodItems.filter((_, i) => i !== index));
  };

  const saveMeal = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      const totalNutrition = foodItems.reduce(
        (acc, item) => ({
          calories: acc.calories + item.calories,
          carbs: acc.carbs + item.carbs,
          fats: acc.fats + item.fats,
          proteins: acc.proteins + item.proteins,
        }),
        { calories: 0, carbs: 0, fats: 0, proteins: 0 }
      );

      const meal: Meal = {
        id: Date.now().toString(),
        userId: '1',
        timestamp: new Date(),
        type: getMealType(),
        items: foodItems,
        totalNutrition,
      };

      // Save to Tableland if connected
      if (isConnected && tablelandService && userTable) {
        await tablelandService.saveMeal(meal);
      } else {
        // Fall back to local storage
        addMeal(meal);
      }
      
      navigate('/');
    } catch (err) {
      console.error('Failed to save meal:', err);
      setError('Failed to save meal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getMealType = (): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
    const hour = new Date().getHours();
    if (hour < 10) return 'breakfast';
    if (hour < 14) return 'lunch';
    if (hour < 18) return 'dinner';
    return 'snack';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/')} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">Add Meal</h1>
          <div className="w-10" />
        </div>

        {/* Camera/Upload Section */}
        {isCapturing && (
          <div className="mb-6">
            <div className="relative bg-black rounded-2xl overflow-hidden mb-4 aspect-square">
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={captureImage}
                className="flex-1 bg-purple-600 text-white rounded-full py-3 font-medium hover:bg-purple-700 transition"
              >
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-white border border-gray-300 rounded-full py-3 font-medium hover:bg-gray-50 transition"
              >
                Upload Photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Analyzing State */}
        {isAnalyzing && (
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="animate-spin">🤖</div>
            </div>
            <h2 className="text-lg font-semibold mb-2">Analyzing your meal...</h2>
            <p className="text-gray-500">Powered by Decentralized AI</p>
            <p className="text-xs text-purple-600 mt-2">Running on Lit Protocol Network</p>
          </div>
        )}

        {/* Results */}
        {!isCapturing && !isAnalyzing && foodItems.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Detected Items</h2>
              {analysisMetadata.network && (
                <div className="text-xs text-gray-500">
                  {analysisMetadata.network === 'lit-protocol' ? (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                      🌐 Decentralized
                    </span>
                  ) : (
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      ⚡ Fallback
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {analysisMetadata.providersUsed && analysisMetadata.providersUsed > 1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  ✨ Analysis aggregated from {analysisMetadata.providersUsed} AI providers
                  {analysisMetadata.confidence && (
                    <span className="ml-2">
                      ({analysisMetadata.confidence} confidence)
                    </span>
                  )}
                </p>
              </div>
            )}
            <div className="space-y-3 mb-6">
              {foodItems.map((item, index) => (
                <div key={index} className="bg-white rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateFoodItem(index, 'name', e.target.value)}
                      className="font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 outline-none"
                    />
                    <button
                      onClick={() => removeFoodItem(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Quantity</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateFoodItem(index, 'quantity', parseInt(e.target.value))}
                          className="w-20 p-1 border rounded"
                        />
                        <span className="text-sm">{item.unit}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Calories</label>
                      <input
                        type="number"
                        value={item.calories}
                        onChange={(e) => updateFoodItem(index, 'calories', parseInt(e.target.value))}
                        className="w-20 p-1 border rounded"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Nutrition */}
            <div className="bg-purple-50 rounded-xl p-4 mb-6">
              <h3 className="font-medium mb-2">Total Nutrition</h3>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="font-semibold">
                    {foodItems.reduce((sum, item) => sum + item.calories, 0)}
                  </div>
                  <div className="text-xs text-gray-500">kcal</div>
                </div>
                <div>
                  <div className="font-semibold">
                    {foodItems.reduce((sum, item) => sum + item.carbs, 0)}g
                  </div>
                  <div className="text-xs text-gray-500">Carbs</div>
                </div>
                <div>
                  <div className="font-semibold">
                    {foodItems.reduce((sum, item) => sum + item.fats, 0)}g
                  </div>
                  <div className="text-xs text-gray-500">Fats</div>
                </div>
                <div>
                  <div className="font-semibold">
                    {foodItems.reduce((sum, item) => sum + item.proteins, 0)}g
                  </div>
                  <div className="text-xs text-gray-500">Proteins</div>
                </div>
              </div>
            </div>

            <button
              onClick={saveMeal}
              disabled={isSaving}
              className="w-full bg-purple-600 text-white rounded-full py-4 font-medium hover:bg-purple-700 transition disabled:bg-purple-400"
            >
              {isSaving ? 'Saving...' : isConnected ? 'Save to Blockchain' : 'Save Locally'}
            </button>
            
            {isConnected && userTable && (
              <p className="text-xs text-center text-gray-500 mt-2">
                Saving to table: {userTable}
              </p>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}