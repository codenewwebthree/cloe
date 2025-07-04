import { LitAIClient } from './lit-client';
import type { FoodItem, NutritionInfo } from '@cloe/types';
import * as ethers from 'ethers';

export interface DecentralizedAnalysisResult {
  items: FoodItem[];
  totalNutrition: NutritionInfo;
  providersUsed: number;
  confidence: 'high' | 'medium' | 'low';
  timestamp: number;
  network: string;
  signature?: string;
}

export class DecentralizedAIService {
  private litClient: LitAIClient;
  private wallet: ethers.Wallet | null = null;

  constructor() {
    this.litClient = new LitAIClient();
  }

  async initialize(privateKey?: string): Promise<void> {
    await this.litClient.connect();
    
    // Create or use provided wallet for signing
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey);
    } else {
      // Generate a temporary wallet for the session
      this.wallet = ethers.Wallet.createRandom();
    }
  }

  async analyzeFood(imageBase64: string, openRouterApiKey: string): Promise<DecentralizedAnalysisResult> {
    if (!this.wallet) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    try {
      // Create authentication signature
      const authSig = await this.litClient.createAuthSig(this.wallet);

      // Execute the decentralized food analysis
      const result = await this.litClient.analyzeFoodImage({
        imageBase64,
        apiKeys: {
          openrouter: openRouterApiKey
        },
        authSig,
        pkpPublicKey: this.wallet.publicKey
      });

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      // Transform the result to match our interface
      const analysisResult: DecentralizedAnalysisResult = {
        items: result.data.items.map((item: any) => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          calories: item.calories,
          carbs: item.carbs,
          fats: item.fats,
          proteins: item.proteins
        })),
        totalNutrition: result.data.totalNutrition,
        providersUsed: result.data.providersUsed || 1,
        confidence: result.data.confidence || 'medium',
        timestamp: result.timestamp,
        network: result.network,
        signature: result.signature
      };

      return analysisResult;

    } catch (error) {
      console.error('Decentralized AI analysis failed:', error);
      throw new Error(`Failed to analyze food: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.litClient.disconnect();
    this.wallet = null;
  }

  getWalletAddress(): string | null {
    return this.wallet?.address || null;
  }

  // Fallback method that can use centralized OpenRouter if Lit network is unavailable
  async analyzeFoodFallback(imageBase64: string, openRouterApiKey: string): Promise<DecentralizedAnalysisResult> {
    console.warn('Using fallback centralized analysis');
    
    const prompt = `You are a nutrition expert AI. Analyze this food image and identify all food items with their estimated portions and nutritional values.

Provide a JSON response in this exact format:
{
  "items": [
    {
      "name": "Food item name",
      "quantity": 100,
      "unit": "g",
      "calories": 165,
      "carbs": 0,
      "fats": 10,
      "proteins": 20
    }
  ],
  "totalNutrition": {
    "calories": 165,
    "carbs": 0,
    "fats": 10,
    "proteins": 20
  }
}

Be accurate with portion sizes based on visual cues. Only return the JSON, no other text.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': 'https://cloe.health',
          'X-Title': 'Cloe - AI Health Assistant (Fallback)',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const result = JSON.parse(content.replace(/```json|```/g, '').trim());

      return {
        items: result.items.map((item: any) => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          calories: item.calories,
          carbs: item.carbs,
          fats: item.fats,
          proteins: item.proteins
        })),
        totalNutrition: result.totalNutrition,
        providersUsed: 1,
        confidence: 'low',
        timestamp: Date.now(),
        network: 'centralized-fallback'
      };

    } catch (error) {
      throw new Error(`Fallback analysis failed: ${error.message}`);
    }
  }
}