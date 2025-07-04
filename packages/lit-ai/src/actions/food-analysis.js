// Lit Action for Decentralized Food Analysis
// This runs on the Lit Network and aggregates results from multiple AI providers

const foodAnalysisAction = async () => {
  try {
    const { imageBase64, apiKeys } = params;

    // Nutrition analysis prompt for all providers
    const analysisPrompt = `You are a nutrition expert AI. Analyze this food image and identify all food items with their estimated portions and nutritional values.

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

Be accurate with portion sizes based on visual cues. Common portion references:
- Chicken breast: typically 150-200g
- Rice/quinoa cooked: 150-200g per serving
- Vegetables: 50-150g depending on type
- Salad greens: 50-100g

Only return the JSON, no other text.`;

    // Function to call OpenRouter with different models
    const callOpenRouter = async (model, apiKey) => {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
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
        
        // Clean and parse JSON response
        const cleanContent = content.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanContent);
      } catch (error) {
        console.error(`Error with ${model}:`, error);
        return null;
      }
    };

    // Fetch results from multiple AI models in parallel
    const aiProviders = [
      { model: 'google/gemini-2.0-flash-exp', key: apiKeys.openrouter },
      { model: 'anthropic/claude-3.5-sonnet', key: apiKeys.openrouter },
      { model: 'openai/gpt-4o', key: apiKeys.openrouter }
    ];

    const results = await Promise.allSettled(
      aiProviders.map(provider => callOpenRouter(provider.model, provider.key))
    );

    // Filter successful results
    const validResults = results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    if (validResults.length === 0) {
      throw new Error('All AI providers failed');
    }

    // Aggregate results from multiple providers
    const aggregateResults = (results) => {
      if (results.length === 1) {
        return results[0];
      }

      // Combine all unique food items
      const allItems = [];
      const itemMap = new Map();

      results.forEach(result => {
        if (result.items && Array.isArray(result.items)) {
          result.items.forEach(item => {
            const key = item.name.toLowerCase().trim();
            if (itemMap.has(key)) {
              // Average the values if item appears multiple times
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

      // Calculate total nutrition
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

    // Sign the result for authenticity
    const resultHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(JSON.stringify(aggregatedResult))
    );

    const signature = await Lit.Actions.signEcdsa({
      toSign: ethers.utils.arrayify(resultHash),
      publicKey,
      sigName: "nutritionAnalysis"
    });

    return {
      success: true,
      data: aggregatedResult,
      signature: signature,
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

// Export for Lit Protocol
foodAnalysisAction;