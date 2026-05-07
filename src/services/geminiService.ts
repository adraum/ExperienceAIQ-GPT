import { RawReview, AnalyzedReview, ThemeSummary, CustomThemeInput, ThemeDefinition } from "../types";

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ResponseFormat =
  | { type: 'json_object' }
  | { type: 'json_schema'; json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean } };

interface AiCallOptions {
  messages: ChatMessage[];
  response_format?: ResponseFormat;
  max_completion_tokens?: number;
}

const AI_ENDPOINT = '/api/ai';

async function callAi({ messages, response_format, max_completion_tokens }: AiCallOptions): Promise<string> {
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      response_format,
      max_completion_tokens: max_completion_tokens ?? 16384,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return (data.content as string) ?? '';
}

function safeParseJson<T>(text: string, fallback: T): T {
  if (!text) return fallback;
  const trimmed = text.trim();
  // Strip markdown code fences if the model added any.
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to locate first JSON array/object in the text.
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // fall through
      }
    }
    return fallback;
  }
}

export const analyzeLanguage = async (reviews: RawReview[]): Promise<string> => {
  const sample = reviews.filter(r => r.Review.length > 0).slice(0, 50).map(r => r.Review).join('\n');
  const text = await callAi({
    messages: [
      { role: 'system', content: 'You identify the primary language of text. Respond with only the language name in English (e.g., English, German, Spanish, French). No punctuation, no extra words, no formatting.' },
      { role: 'user', content: `Identify the primary language of these reviews:\n\n${sample}` },
    ],
    max_completion_tokens: 64,
  });
  const cleaned = text
    .trim()
    .replace(/["'`*_]/g, '')
    .replace(/[.,;:!?]+$/g, '')
    .trim();
  return cleaned.split(/\s|\n/)[0] || 'English';
};

export const extractThemes = async (reviews: RawReview[], language: string, customThemes?: CustomThemeInput[]): Promise<ThemeDefinition[]> => {
  if (customThemes && customThemes.length > 0) {
    return customThemes.map(t => ({ theme: t.name, description: t.description }));
  }

  const sample = reviews.filter(r => r.Review.length > 0).slice(0, 1000).map(r => `[${r.Location}]: ${r.Review}`).join('\n---\n');

  const text = await callAi({
    messages: [
      {
        role: 'system',
        content: 'You are an expert CX data analyst. You MUST extract multiple distinct, granular themes. Never return just one single broad theme. Always return JSON with an array of 8 to 12 themes.',
      },
      {
        role: 'user',
        content: `Analyze these customer reviews. The reviews are in ${language}.
Exploratively identify the top 8 to 12 most frequent specific themes/topics discussed across the entire dataset. The themes should be granular and distinct (e.g., "Customer Service", "Pricing", "Cleanliness", "Wait Time", "Product Quality" rather than broad categories like "Overall Experience"). Provide a concise, descriptive name for each theme and a short description of what it entails. You MUST return between 8 and 12 themes.

IMPORTANT: You MUST write the 'theme' names and the 'description' entirely in ${language}.

Return JSON in the following shape:
{ "themes": [ { "theme": "string", "description": "string" }, ... ] }

Reviews:
${sample}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const parsed = safeParseJson<{ themes?: ThemeDefinition[] } | ThemeDefinition[]>(text, { themes: [] });
  const arr = Array.isArray(parsed) ? parsed : (parsed.themes || []);
  return arr.filter(t => t && typeof t.theme === 'string').map(t => ({ theme: t.theme, description: t.description || '' }));
};

interface BatchThemeResult {
  index: number;
  themes: { theme: string; sentiment: string; snippet: string }[];
}

const buildBatchPrompt = (reviewsWithText: RawReview[], themesList: string, language: string, indexOffset = 0): string => `Analyze the following reviews. The reviews are in ${language}.
For each review, identify which of the following themes are present, and determine the sentiment (positive, negative, or neutral) for each present theme.
ALSO, for each present theme, extract a short, relevant snippet (maximum 150 characters) directly from the review text that represents this theme. Do not include the full review, only the relevant part.

IMPORTANT: The themes provided below are in ${language}. You must match the theme names exactly as they are written.

Return JSON in the following shape:
{ "results": [ { "index": <number>, "themes": [ { "theme": "string", "sentiment": "positive|negative|neutral", "snippet": "string" } ] } ] }

The 'index' field MUST exactly match the index number provided in the [Review X] tag.

Themes to check:
- ${themesList}

Reviews:
${reviewsWithText.map((r, idx) => `[Review ${idx + indexOffset}]: ${r.Review}`).join('\n')}
`;

const requestBatchAnalysis = async (prompt: string): Promise<BatchThemeResult[]> => {
  const text = await callAi({
    messages: [
      { role: 'system', content: 'You are an expert CX data analyst. Return ONLY valid JSON matching the requested shape.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });
  const parsed = safeParseJson<{ results?: BatchThemeResult[] } | BatchThemeResult[]>(text, { results: [] });
  if (Array.isArray(parsed)) return parsed;
  return parsed.results || [];
};

export const analyzeReviewsBatch = async (reviews: RawReview[], themes: { name: string, description?: string }[], language: string, onProgress?: (progress: number, analyzedCount: number, totalCount: number) => void): Promise<AnalyzedReview[]> => {
  const batchSize = 10;
  const results: AnalyzedReview[] = [];

  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize);
    const reviewsWithText = batch.filter(r => r.Review.length > 0);

    if (reviewsWithText.length === 0) {
      batch.forEach(r => results.push({ ...r, themes: [] }));
      if (onProgress) {
        const analyzedCount = Math.min(reviews.length, i + batchSize);
        onProgress(Math.min(100, Math.round((analyzedCount / reviews.length) * 100)), analyzedCount, reviews.length);
      }
      continue;
    }

    const themesList = themes.map(t => t.description ? `${t.name} (${t.description})` : t.name).join('\n    - ');

    let parsed: BatchThemeResult[] = [];
    try {
      parsed = await requestBatchAnalysis(buildBatchPrompt(reviewsWithText, themesList, language));
    } catch (e) {
      console.error('Failed to parse batch, retrying with half batch size', e);
      try {
        const halfBatchSize = Math.max(1, Math.floor(reviewsWithText.length / 2));
        const firstHalf = reviewsWithText.slice(0, halfBatchSize);
        const secondHalf = reviewsWithText.slice(halfBatchSize);

        const parsedFirst = firstHalf.length
          ? await requestBatchAnalysis(buildBatchPrompt(firstHalf, themesList, language, 0))
          : [];
        const parsedSecond = secondHalf.length
          ? await requestBatchAnalysis(buildBatchPrompt(secondHalf, themesList, language, halfBatchSize))
          : [];

        parsed = [...parsedFirst, ...parsedSecond];
      } catch (retryError) {
        console.error('Retry failed', retryError);
        parsed = [];
      }
    }

    batch.forEach((review) => {
      if (review.Review.length === 0) {
        results.push({ ...review, themes: [] });
        return;
      }

      const textIdx = reviewsWithText.indexOf(review);
      const match = parsed.find(p => p.index === textIdx);

      if (match) {
        const validThemes = (match.themes || [])
          .filter(t =>
            t.theme && t.sentiment &&
            themes.some(th => th.name.toLowerCase() === t.theme.toLowerCase()) &&
            ['positive', 'negative', 'neutral'].includes(t.sentiment.toLowerCase())
          )
          .map(t => {
            const matchedTheme = themes.find(th => th.name.toLowerCase() === t.theme.toLowerCase());
            return {
              theme: matchedTheme ? matchedTheme.name : t.theme,
              sentiment: t.sentiment.toLowerCase() as 'positive' | 'negative' | 'neutral',
              snippet: t.snippet || '',
            };
          });

        results.push({ ...review, themes: validThemes });
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

interface SummaryResultRaw {
  theme: string;
  summary: string;
  firmSummaries?: { location: string; summary: string }[] | Record<string, string>;
}

export const generateSummaries = async (
  analyzedReviews: AnalyzedReview[],
  themeDefs: ThemeDefinition[],
  language: string
): Promise<ThemeSummary[]> => {
  const summariesByTheme = new Map<string, ThemeSummary>();
  const themeBatchSize = 3;

  // Themes with no review mentions are summarised locally so we never lose them
  // (the LLM tends to drop empty entries).
  const themesWithMentions: ThemeDefinition[] = [];
  for (const td of themeDefs) {
    const hasMention = analyzedReviews.some(r => r.themes.some(t => t.theme === td.theme));
    if (!hasMention) {
      summariesByTheme.set(td.theme, {
        theme: td.theme,
        summary: 'No reviews matched this theme in the dataset.',
        firmSummaries: {},
      });
    } else {
      themesWithMentions.push(td);
    }
  }

  for (let i = 0; i < themesWithMentions.length; i += themeBatchSize) {
    const themeBatch = themesWithMentions.slice(i, i + themeBatchSize);
    const themeData = themeBatch.map(td => {
      const locationsData: Record<string, string[]> = {};
      const overallReviews: string[] = [];

      analyzedReviews.forEach(r => {
        const t = r.themes.find(x => x.theme === td.theme);
        if (t) {
          if (!locationsData[r.Location]) locationsData[r.Location] = [];
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
        overall: overallReviews,
      };
    });

    const promptData = JSON.stringify(themeData, null, 2);

    try {
      const text = await callAi({
        messages: [
          {
            role: 'system',
            content: 'You are an expert CX data analyst. Your job is to read full customer reviews and write concise, accurate summaries for themes, both overall and broken down by location. Return ONLY valid JSON.',
          },
          {
            role: 'user',
            content: `Based on the following theme definitions and full customer reviews (grouped by location and overall), generate concise summaries.
The summaries MUST be written in ${language}.
For EACH theme in the input, you MUST return exactly one entry in the output — never drop a theme.
For each theme, provide an 'overall' summary of what customers are saying.
Also provide a tailored summary for EACH specific location listed under that theme.
ONLY generate summaries for locations that have reviews provided in the data. If a location has no reviews for a theme, do not include it in the firmSummaries array.
Do not hallucinate. Base the summaries ONLY on the provided reviews.

Return JSON in this exact shape:
{ "summaries": [ { "theme": "string", "summary": "string", "firmSummaries": [ { "location": "string", "summary": "string" } ] } ] }

Data:
${promptData}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = safeParseJson<{ summaries?: SummaryResultRaw[] } | SummaryResultRaw[]>(text, { summaries: [] });
      const arr: SummaryResultRaw[] = Array.isArray(parsed) ? parsed : (parsed.summaries || []);

      arr.forEach(item => {
        if (!item || !item.theme) return;
        const firmSummariesRecord: Record<string, string> = {};
        if (Array.isArray(item.firmSummaries)) {
          item.firmSummaries.forEach(fs => {
            if (fs && fs.location && fs.summary) {
              firmSummariesRecord[fs.location] = fs.summary;
            }
          });
        } else if (item.firmSummaries && typeof item.firmSummaries === 'object') {
          Object.assign(firmSummariesRecord, item.firmSummaries);
        }
        summariesByTheme.set(item.theme, {
          theme: item.theme,
          summary: item.summary || '',
          firmSummaries: firmSummariesRecord,
        });
      });
    } catch (e) {
      console.error('Failed to parse summaries batch', e);
    }
  }

  // Backfill any theme the LLM might still have skipped, preserving the input order.
  return themeDefs.map(td =>
    summariesByTheme.get(td.theme) ?? {
      theme: td.theme,
      summary: 'Summary could not be generated for this theme.',
      firmSummaries: {},
    }
  );
};

export type DeepDiveStatus =
  | { phase: 'analyzing'; currentPart: number; totalParts: number; estimatedTokens: number; splitNeeded: boolean }
  | { phase: 'merging'; currentPart: number; totalParts: number; estimatedTokens: number; splitNeeded: true };

const DEEP_DIVE_TOKEN_LIMIT = 250_000;
const estimateTokens = (text: string): number => Math.ceil(text.length / 3);

export const getDeepAnalysis = async (
  reviews: AnalyzedReview[],
  language: string,
  location?: string,
  onStatus?: (status: DeepDiveStatus) => void,
): Promise<string> => {
  const filtered = reviews.filter(r => r.Review.length > 20);
  const focus = location
    ? `Focus your analysis specifically on the location: "${location}". Include what sets this specific firm/location apart compared to the others, its unique strengths and weaknesses, and tailored strategic recommendations.`
    : 'Provide a comparative analysis of all locations.';

  const systemContent = 'You are a Senior Data Analyst specialized in customer experience benchmarking.';
  const buildContext = (rs: AnalyzedReview[]) =>
    rs.map(r => `[${r.Location} - ${r.Stars} Stars - ${r.Date}]: ${r.Review}`).join('\n');

  const buildUserPrompt = (context: string, partInfo?: { partNum: number; totalParts: number }) => {
    const partHeader = partInfo
      ? `IMPORTANT: This is part ${partInfo.partNum} of ${partInfo.totalParts} of a larger dataset. Analyze ONLY the reviews provided below; the merge step will combine your output with the analyses of the other parts.\n\n`
      : '';
    return `${partHeader}Here is a dataset of customer reviews.
${focus}

Identify root causes for negative feedback, highlight comparative strengths, and provide actionable strategic recommendations.
Connect subtle patterns in the text with the star ratings.
IMPORTANT: You MUST write your entire analysis and response in ${language}.

${context}`;
  };

  const fullContext = buildContext(filtered);
  const fullPrompt = systemContent + buildUserPrompt(fullContext);
  const estimatedTokens = estimateTokens(fullPrompt);
  const splitNeeded = estimatedTokens > DEEP_DIVE_TOKEN_LIMIT;

  try {
    if (!splitNeeded) {
      onStatus?.({ phase: 'analyzing', currentPart: 1, totalParts: 1, estimatedTokens, splitNeeded: false });
      return await callAi({
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: buildUserPrompt(fullContext) },
        ],
      });
    }

    // Split into two halves + merge call (3 API calls in total).
    const half = Math.ceil(filtered.length / 2);
    const part1 = filtered.slice(0, half);
    const part2 = filtered.slice(half);

    onStatus?.({ phase: 'analyzing', currentPart: 1, totalParts: 3, estimatedTokens, splitNeeded: true });
    const analysis1 = await callAi({
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: buildUserPrompt(buildContext(part1), { partNum: 1, totalParts: 2 }) },
      ],
    });

    onStatus?.({ phase: 'analyzing', currentPart: 2, totalParts: 3, estimatedTokens, splitNeeded: true });
    const analysis2 = await callAi({
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: buildUserPrompt(buildContext(part2), { partNum: 2, totalParts: 2 }) },
      ],
    });

    onStatus?.({ phase: 'merging', currentPart: 3, totalParts: 3, estimatedTokens, splitNeeded: true });
    return await callAi({
      messages: [
        { role: 'system', content: systemContent },
        {
          role: 'user',
          content: `You are merging two preliminary strategic analyses of the SAME customer review dataset that was split into two halves due to its size.
${focus}
Combine them into a single, coherent strategic deep-dive analysis as if you had analyzed the full dataset at once. Do NOT present them as two separate sections. Synthesize the root causes for negative feedback, comparative strengths, patterns, and actionable strategic recommendations across both halves. Remove redundancies, resolve any contradictions in favor of the stronger evidence, and preserve every unique insight from either half.
IMPORTANT: You MUST write your entire response in ${language}.

=== Analysis of Part 1 of 2 ===
${analysis1}

=== Analysis of Part 2 of 2 ===
${analysis2}`,
        },
      ],
    });
  } catch (e) {
    console.error('Deep analysis failed', e);
    return 'Failed to generate deep analysis. Please try again.';
  }
};

export const chatWithData = async (history: { role: 'user' | 'model', text: string }[], reviews: AnalyzedReview[], language: string): Promise<string> => {
  const context = reviews.filter(r => r.Review.length > 0).map(r => {
    const themesStr = r.themes && r.themes.length > 0
      ? ` [Themes: ${r.themes.map(t => `${t.theme} (${t.sentiment})`).join(', ')}]`
      : '';
    const addressStr = r.Address ? ` - Address: ${r.Address}` : '';
    return `[${r.Location}${addressStr} - ${r.Date} - ${r.Stars} Stars]${themesStr}: ${r.Review}`;
  }).join('\n');

  const systemContent = `You are an AI assistant for a CX Benchmarking app.
Answer the user's question ONLY based on the provided reviews dataset.
If the question cannot be answered using the dataset, explicitly state that you cannot answer it because the data does not contain that information. Do not make up information or hallucinate.
You have access to the conversation history. Refer to previous turns and specific reviews or themes when relevant.
IMPORTANT: You MUST write your entire response in ${language}.

The dataset includes metadata for each review such as Location, Address (if available), Date, and Star Rating. You CAN and SHOULD use this metadata to answer questions about longitudinal development, timeseries trends, location comparisons, rating distributions, and geographic questions based on the address.

The dataset is provided in the following format for each review:
[Location - Address: ... - Date - Stars Stars] [Themes: theme1 (sentiment), theme2 (sentiment)] : Review text

Dataset:
${context}`;

  const validHistory = [...history];
  while (validHistory.length > 0 && validHistory[0].role === 'model') {
    validHistory.shift();
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...validHistory.map(m => ({
      role: (m.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.text,
    })),
  ];

  try {
    return await callAi({
      messages,
    });
  } catch (e) {
    console.error('Chat failed', e);
    return 'Failed to generate response. Please try again.';
  }
};
