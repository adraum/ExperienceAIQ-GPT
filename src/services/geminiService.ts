import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { RawReview, AnalyzedReview, ThemeSummary, CustomThemeInput, ThemeDefinition } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const analyzeLanguage = async (reviews: RawReview[]): Promise<string> => {
  const sample = reviews.filter(r => r.Review.length > 0).slice(0, 50).map(r => r.Review).join('\n');
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Identify the primary language of these reviews. Return ONLY the language name (e.g., English, German, Spanish).\n\n${sample}`,
  });
  return response.text?.trim() || 'English';
};

export const extractThemes = async (reviews: RawReview[], language: string, customThemes?: CustomThemeInput[]): Promise<ThemeDefinition[]> => {
  if (customThemes && customThemes.length > 0) {
    return customThemes.map(t => ({ theme: t.name, description: t.description }));
  }

  const sample = reviews.filter(r => r.Review.length > 0).slice(0, 1000).map(r => `[${r.Location}]: ${r.Review}`).join('\n---\n');
  
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Analyze these customer reviews. The reviews are in ${language}. 
    Exploratively identify the top 8 to 12 most frequent specific themes/topics discussed across the entire dataset. The themes should be granular and distinct (e.g., "Customer Service", "Pricing", "Cleanliness", "Wait Time", "Product Quality" rather than broad categories like "Overall Experience"). Provide a concise, descriptive name for each theme and a short description of what it entails. You MUST return between 8 and 12 themes.
    
    IMPORTANT: You MUST write the 'theme' names and the 'description' entirely in ${language}.
    
    Reviews:
    ${sample}`,
    config: {
      systemInstruction: "You are an expert CX data analyst. You MUST extract multiple distinct, granular themes. Never return just one single broad theme. Always return an array of 8 to 12 themes.",
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        description: "An array of theme objects.",
        items: {
          type: Type.OBJECT,
          properties: {
            theme: { type: Type.STRING, description: "Short name of the theme (e.g., Customer Service, Pricing)" },
            description: { type: Type.STRING, description: "Short description of what this theme covers" }
          },
          required: ["theme", "description"]
        }
      }
    }
  });
  
  const text = response.text || '[]';
  try {
    let parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      parsed = [parsed];
    }
    return parsed;
  } catch (e) {
    console.error("Failed to parse themes", e);
    return [];
  }
};

export const analyzeReviewsBatch = async (reviews: RawReview[], themes: {name: string, description?: string}[], language: string, onProgress?: (progress: number, analyzedCount: number, totalCount: number) => void): Promise<AnalyzedReview[]> => {
  let batchSize = 10; // Smaller batch size to avoid output token limits
  const results: AnalyzedReview[] = [];
  
  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize);
    
    // Filter out reviews with no text for the prompt
    const reviewsWithText = batch.filter(r => r.Review.length > 0);
    
    if (reviewsWithText.length === 0) {
      // If all reviews in this batch have no text, just push them with empty themes
      batch.forEach(r => results.push({ ...r, themes: [] }));
      if (onProgress) {
        const analyzedCount = Math.min(reviews.length, i + batchSize);
        onProgress(Math.min(100, Math.round((analyzedCount / reviews.length) * 100)), analyzedCount, reviews.length);
      }
      continue;
    }

    const themesList = themes.map(t => t.description ? `${t.name} (${t.description})` : t.name).join('\n    - ');

    const prompt = `Analyze the following reviews. The reviews are in ${language}. 
    For each review, identify which of the following themes are present, and determine the sentiment (positive, negative, or neutral) for each present theme.
    ALSO, for each present theme, extract a short, relevant snippet (maximum 150 characters) directly from the review text that represents this theme. Do not include the full review, only the relevant part.
    
    IMPORTANT: The themes provided below are in ${language}. You must match the theme names exactly as they are written.
    Your output MUST be an array of objects, where each object corresponds to a review. The 'index' field MUST exactly match the index number provided in the [Review X] tag.
    
    Themes to check:
    - ${themesList}
    
    Reviews:
    ${reviewsWithText.map((r, idx) => `[Review ${idx}]: ${r.Review}`).join('\n')}
    `;
    
    let parsed: any = null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                index: { type: Type.INTEGER, description: "The index of the review in the batch" },
                themes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      theme: { type: Type.STRING, description: "The theme name (must exactly match one of the provided themes)" },
                      sentiment: { type: Type.STRING, description: "positive, negative, or neutral" },
                      snippet: { type: Type.STRING, description: "A short, relevant quote from the review (max 150 chars)" }
                    },
                    required: ["theme", "sentiment", "snippet"]
                  }
                }
              },
              required: ["index", "themes"]
            }
          }
        }
      });
      
      parsed = JSON.parse(response.text || '[]');
    } catch (e) {
      console.error("Failed to parse batch, retrying with half batch size", e);
      try {
        // Retry with half the batch size
        const halfBatchSize = Math.max(1, Math.floor(reviewsWithText.length / 2));
        const firstHalf = reviewsWithText.slice(0, halfBatchSize);
        const secondHalf = reviewsWithText.slice(halfBatchSize);
        
        const processHalf = async (half: RawReview[], offset: number) => {
          if (half.length === 0) return [];
          const halfPrompt = `Analyze the following reviews. The reviews are in ${language}. 
          For each review, identify which of the following themes are present, and determine the sentiment (positive, negative, or neutral) for each present theme.
          ALSO, for each present theme, extract a short, relevant snippet (maximum 150 characters) directly from the review text that represents this theme. Do not include the full review, only the relevant part.
          
          IMPORTANT: The themes provided below are in ${language}. You must match the theme names exactly as they are written.
          Your output MUST be an array of objects, where each object corresponds to a review. The 'index' field MUST exactly match the index number provided in the [Review X] tag.
          
          Themes to check:
          - ${themesList}
          
          Reviews:
          ${half.map((r, idx) => `[Review ${idx + offset}]: ${r.Review}`).join('\n')}
          `;
          
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: halfPrompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    index: { type: Type.INTEGER, description: "The index of the review in the batch" },
                    themes: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          theme: { type: Type.STRING, description: "The theme name (must exactly match one of the provided themes)" },
                          sentiment: { type: Type.STRING, description: "positive, negative, or neutral" },
                          snippet: { type: Type.STRING, description: "A short, relevant quote from the review (max 150 chars)" }
                        },
                        required: ["theme", "sentiment", "snippet"]
                      }
                    }
                  },
                  required: ["index", "themes"]
                }
              }
            }
          });
          return JSON.parse(response.text || '[]');
        };
        
        const parsedFirst = await processHalf(firstHalf, 0);
        const parsedSecond = await processHalf(secondHalf, halfBatchSize);
        
        parsed = [...(Array.isArray(parsedFirst) ? parsedFirst : [parsedFirst]), ...(Array.isArray(parsedSecond) ? parsedSecond : [parsedSecond])];
      } catch (retryError) {
        console.error("Retry failed", retryError);
        parsed = [];
      }
    }
    
    if (!Array.isArray(parsed)) {
      parsed = [parsed];
    }
    
    batch.forEach((review) => {
      if (review.Review.length === 0) {
        results.push({ ...review, themes: [] });
        return;
      }
      
      // Find the index of this review in the reviewsWithText array
      const textIdx = reviewsWithText.indexOf(review);
      const match = parsed.find((p: any) => p.index === textIdx);
      
      if (match) {
        const validThemes = (match.themes || [])
          .filter((t: any) => 
            t.theme && t.sentiment &&
            themes.some(th => th.name.toLowerCase() === t.theme.toLowerCase()) && 
            ['positive', 'negative', 'neutral'].includes(t.sentiment.toLowerCase())
          )
          .map((t: any) => {
            const matchedTheme = themes.find(th => th.name.toLowerCase() === t.theme.toLowerCase());
            return {
              theme: matchedTheme ? matchedTheme.name : t.theme,
              sentiment: t.sentiment.toLowerCase() as 'positive' | 'negative' | 'neutral',
              snippet: t.snippet || ''
            };
          });

        results.push({
          ...review,
          themes: validThemes
        });
      } else {
        results.push({ ...review, themes: [] });
      }
    });
    
    if (onProgress) {
      const analyzedCount = Math.min(reviews.length, i + batchSize);
      onProgress(Math.min(100, Math.round((analyzedCount / reviews.length) * 100)), analyzedCount, reviews.length);
    }
  }
  
  return results;
};

export const generateSummaries = async (
  analyzedReviews: AnalyzedReview[],
  themeDefs: ThemeDefinition[],
  language: string
): Promise<ThemeSummary[]> => {
  const allSummaries: ThemeSummary[] = [];
  const themeBatchSize = 3; // Process 3 themes at a time to avoid output token limits
  
  for (let i = 0; i < themeDefs.length; i += themeBatchSize) {
    const themeBatch = themeDefs.slice(i, i + themeBatchSize);
    const themeData = themeBatch.map(td => {
      const locationsData: Record<string, string[]> = {};
      let overallReviews: string[] = [];
      
      analyzedReviews.forEach(r => {
        const t = r.themes.find(x => x.theme === td.theme);
        if (t) {
          if (!locationsData[r.Location]) locationsData[r.Location] = [];
          // Use full review text instead of snippet for summary generation to capture nuance
          if (locationsData[r.Location].length < 30) {
            locationsData[r.Location].push(`[${t.sentiment}] ${r.Review}`);
          }
          if (overallReviews.length < 100) {
            overallReviews.push(`[${t.sentiment}] ${r.Review}`);
          }
        }
      });
      
      return {
        theme: td.theme,
        description: td.description,
        locations: locationsData,
        overall: overallReviews
      };
    });

    const promptData = JSON.stringify(themeData, null, 2);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Based on the following theme definitions and full customer reviews (grouped by location and overall), generate concise summaries.
        The summaries MUST be written in ${language}.
        For each theme, provide an 'overall' summary of what customers are saying.
        Also provide a tailored summary for EACH specific location listed under that theme.
        ONLY generate summaries for locations that have reviews provided in the data. If a location has no reviews for a theme, do not include it in the firmSummaries array.
        Do not hallucinate. Base the summaries ONLY on the provided reviews.
        
        Data:
        ${promptData}`,
        config: {
          systemInstruction: "You are an expert CX data analyst. Your job is to read full customer reviews and write concise, accurate summaries for themes, both overall and broken down by location.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                theme: { type: Type.STRING },
                summary: { type: Type.STRING, description: "Overall summary for this theme" },
                firmSummaries: {
                  type: Type.ARRAY,
                  description: "Array of summaries for each specific location",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      location: { type: Type.STRING, description: "Exact name of the location" },
                      summary: { type: Type.STRING, description: "Summary of reviews for this location and theme" }
                    },
                    required: ["location", "summary"]
                  }
                }
              },
              required: ["theme", "summary", "firmSummaries"]
            }
          }
        }
      });

      const text = response.text || '[]';
      let parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }
      
      // Map the array of firmSummaries back to a Record<string, string>
      const batchSummaries = parsed.map((item: any) => {
        const firmSummariesRecord: Record<string, string> = {};
        if (Array.isArray(item.firmSummaries)) {
          item.firmSummaries.forEach((fs: any) => {
            if (fs.location && fs.summary) {
              firmSummariesRecord[fs.location] = fs.summary;
            }
          });
        } else if (typeof item.firmSummaries === 'object' && item.firmSummaries !== null) {
          Object.assign(firmSummariesRecord, item.firmSummaries);
        }
        return {
          theme: item.theme,
          summary: item.summary,
          firmSummaries: firmSummariesRecord
        };
      });
      
      allSummaries.push(...batchSummaries);
    } catch (e) {
      console.error("Failed to parse summaries batch", e);
    }
  }
  
  return allSummaries;
};

export const getDeepAnalysis = async (reviews: AnalyzedReview[], language: string, location?: string): Promise<string> => {
  const context = reviews.filter(r => r.Review.length > 0).map(r => `[${r.Location} - ${r.Stars} Stars - ${r.Date}]: ${r.Review}`).join('\n');
  const focus = location ? `Focus your analysis specifically on the location: "${location}". Include what sets this specific firm/location apart compared to the others, its unique strengths and weaknesses, and tailored strategic recommendations.` : "Provide a comparative analysis of all locations.";
  const prompt = `
You are a Senior Data Analyst.
Here is a dataset of customer reviews.
${focus}

Identify root causes for negative feedback, highlight comparative strengths, and provide actionable strategic recommendations.
Use your thinking capabilities to connect subtle patterns in the text with the star ratings.
IMPORTANT: You MUST write your entire analysis and response in ${language}.

${context}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });
    return response.text || '';
  } catch (e) {
    console.error("Deep analysis failed", e);
    return "Failed to generate deep analysis. Please try again.";
  }
};

export const chatWithData = async (history: {role: 'user'|'model', text: string}[], reviews: AnalyzedReview[], language: string): Promise<string> => {
  const context = reviews.filter(r => r.Review.length > 0).map(r => {
    const themesStr = r.themes && r.themes.length > 0 
      ? ` [Themes: ${r.themes.map(t => `${t.theme} (${t.sentiment})`).join(', ')}]` 
      : '';
    return `[${r.Location} - ${r.Date} - ${r.Stars} Stars]${themesStr}: ${r.Review}`;
  }).join('\n');
  
  const systemInstruction = `You are an AI assistant for a CX Benchmarking app.
Answer the user's question ONLY based on the provided reviews dataset.
If the question cannot be answered using the dataset, explicitly state that you cannot answer it because the data does not contain that information. Do not make up information or hallucinate.
You have access to the conversation history. Refer to previous turns and specific reviews or themes when relevant.
IMPORTANT: You MUST write your entire response in ${language}.

The dataset includes metadata for each review such as Location, Date, and Star Rating. You CAN and SHOULD use this metadata to answer questions about longitudinal development, timeseries trends, location comparisons, and rating distributions.

The dataset is provided in the following format for each review:
[Location - Date - Stars Stars] [Themes: theme1 (sentiment), theme2 (sentiment)] : Review text

Dataset:
${context}`;

  let validHistory = [...history];
  while (validHistory.length > 0 && validHistory[0].role === 'model') {
    validHistory.shift();
  }

  const contents = validHistory.map(m => ({
    role: m.role,
    parts: [{ text: m.text }]
  }));
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: contents as any,
      config: {
        systemInstruction
      }
    });
    
    return response.text || '';
  } catch (e) {
    console.error("Chat failed", e);
    return "Failed to generate response. Please try again.";
  }
};
