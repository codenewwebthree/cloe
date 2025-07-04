import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { LIT_NETWORK, LIT_RPC } from '@lit-protocol/constants';
import { LitAbility, LitAccessControlConditionResource } from '@lit-protocol/auth-helpers';
import * as ethers from 'ethers';

export class LitAIClient {
  private litNodeClient: LitNodeClient | null = null;
  private network: string;

  constructor(network: string = LIT_NETWORK.DatilDev) {
    this.network = network;
  }

  async connect(): Promise<void> {
    if (this.litNodeClient?.ready) {
      return;
    }

    this.litNodeClient = new LitNodeClient({
      litNetwork: this.network,
      debug: process.env.NODE_ENV === 'development'
    });

    await this.litNodeClient.connect();
  }

  async disconnect(): Promise<void> {
    if (this.litNodeClient) {
      this.litNodeClient.disconnect();
      this.litNodeClient = null;
    }
  }

  async createAuthSig(wallet: ethers.Wallet): Promise<any> {
    const domain = 'cloe.health';
    const origin = 'https://cloe.health';
    const statement = 'Cloe - AI for Healthier Living - Decentralized Food Analysis';

    const authSig = await this.litNodeClient?.createSiweMessage({
      walletAddress: wallet.address,
      nonce: await this.litNodeClient.getLatestBlockhash(),
      expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
    });

    return authSig;
  }

  async analyzeFoodImage(params: {
    imageBase64: string;
    apiKeys: {
      openrouter: string;
    };
    authSig: any;
    pkpPublicKey?: string;
  }): Promise<any> {
    if (!this.litNodeClient?.ready) {
      throw new Error('Lit client not connected');
    }

    try {
      // Read the food analysis Lit Action
      const foodAnalysisCode = await this.getFoodAnalysisCode();

      const result = await this.litNodeClient.executeJs({
        code: foodAnalysisCode,
        authSig: params.authSig,
        jsParams: {
          imageBase64: params.imageBase64,
          apiKeys: params.apiKeys,
          publicKey: params.pkpPublicKey || '0x0', // Use provided PKP or default
        },
      });

      return result;
    } catch (error) {
      console.error('Error executing Lit Action:', error);
      throw new Error(`Failed to analyze food image: ${error.message}`);
    }
  }

  private async getFoodAnalysisCode(): Promise<string> {
    // In production, this would be loaded from IPFS or other decentralized storage
    // For now, we'll return the action code directly
    return `
const foodAnalysisAction = async () => {
  try {
    const { imageBase64, apiKeys } = params;

    const analysisPrompt = \`You are a nutrition expert AI. Analyze this food image and identify all food items with their estimated portions and nutritional values.

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

Be accurate with portion sizes based on visual cues. Only return the JSON, no other text.\`;

    const callOpenRouter = async (model, apiKey) => {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${apiKey}\`,
            'HTTP-Referer': 'https://cloe.health',
            'X-Title': 'Cloe - Decentralized AI Health Assistant',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: analysisPrompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: \`data:image/jpeg;base64,\${imageBase64}\`
                  }
                }
              ]
            }],
            temperature: 0.3,
            max_tokens: 1000
          })
        });

        if (!response.ok) {
          throw new Error(\`HTTP error! status: \${response.status}\`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        const cleanContent = content.replace(/\`\`\`json|\`\`\`/g, '').trim();
        return JSON.parse(cleanContent);
      } catch (error) {
        console.error(\`Error with \${model}:\`, error);
        return null;
      }
    };

    const aiProviders = [
      { model: 'google/gemini-2.5-pro', key: apiKeys.openrouter },
      { model: 'anthropic/claude-3.5-sonnet', key: apiKeys.openrouter }
    ];

    const results = await Promise.allSettled(
      aiProviders.map(provider => callOpenRouter(provider.model, provider.key))
    );

    const validResults = results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    if (validResults.length === 0) {
      throw new Error('All AI providers failed');
    }

    const aggregateResults = (results) => {
      if (results.length === 1) {
        return results[0];
      }

      const itemMap = new Map();

      results.forEach(result => {
        if (result.items && Array.isArray(result.items)) {
          result.items.forEach(item => {
            const key = item.name.toLowerCase().trim();
            if (itemMap.has(key)) {
              const existing = itemMap.get(key);
              itemMap.set(key, {
                name: item.name,
                quantity: Math.round((existing.quantity + item.quantity) / 2),
                unit: existing.unit,
                calories: Math.round((existing.calories + item.calories) / 2),
                carbs: Math.round(((existing.carbs + item.carbs) / 2) * 10) / 10,
                fats: Math.round(((existing.fats + item.fats) / 2) * 10) / 10,
                proteins: Math.round(((existing.proteins + item.proteins) / 2) * 10) / 10
              });
            } else {
              itemMap.set(key, item);
            }
          });
        }
      });

      const finalItems = Array.from(itemMap.values());

      const totalNutrition = finalItems.reduce((acc, item) => ({
        calories: acc.calories + item.calories,
        carbs: acc.carbs + item.carbs,
        fats: acc.fats + item.fats,
        proteins: acc.proteins + item.proteins
      }), { calories: 0, carbs: 0, fats: 0, proteins: 0 });

      return {
        items: finalItems,
        totalNutrition,
        providersUsed: results.length,
        confidence: results.length >= 2 ? 'high' : 'medium'
      };
    };

    const aggregatedResult = aggregateResults(validResults);

    return {
      success: true,
      data: aggregatedResult,
      timestamp: Date.now(),
      network: 'lit-protocol',
      version: '1.0.0'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: Date.now()
    };
  }
};

foodAnalysisAction();
    `;
  }
}