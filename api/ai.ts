import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

interface AiRequestBody {
  messages: ChatCompletionMessageParam[];
  response_format?:
    | { type: 'json_object' }
    | { type: 'json_schema'; json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean } };
  max_completion_tokens?: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// meinGPT documents 429 with a Retry-After header and asks clients to back off
// exponentially with jitter. We respect Retry-After when present, otherwise
// fall back to 1s/2s/4s/8s with up to 500ms of jitter.
async function callWithRetry(
  client: OpenAI,
  params: Parameters<OpenAI['chat']['completions']['create']>[0],
  maxRetries = 4,
) {
  let attempt = 0;
  let lastError: any;
  while (attempt <= maxRetries) {
    try {
      return await client.chat.completions.create(params);
    } catch (e: any) {
      lastError = e;
      const status = e?.status ?? e?.response?.status;
      if (status !== 429 || attempt === maxRetries) throw e;

      const retryAfterHeader =
        e?.headers?.['retry-after'] ?? e?.response?.headers?.['retry-after'];
      const retryAfterSec = Number.parseInt(String(retryAfterHeader ?? ''), 10);
      const baseDelaySec = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec
        : Math.pow(2, attempt); // 1s, 2s, 4s, 8s
      const jitterMs = Math.floor(Math.random() * 500);
      await sleep(baseDelaySec * 1000 + jitterMs);
      attempt++;
    }
  }
  throw lastError;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const baseURL = process.env.MEINGPT_BASE_URL || 'https://app.meingpt.com/api/external/openai/v1';
  const apiKey = process.env.MEINGPT_API_KEY;
  const model = process.env.MEINGPT_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    res.status(500).json({
      error:
        'meinGPT is not configured. Please set MEINGPT_API_KEY in the Vercel project environment variables.',
    });
    return;
  }

  let body: AiRequestBody;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const { messages, response_format, max_completion_tokens } = body || ({} as AiRequestBody);

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages must be a non-empty array' });
    return;
  }

  const client = new OpenAI({ apiKey, baseURL });

  try {
    const completion = await callWithRetry(client, {
      model,
      messages,
      stream: false,
      // meinGPT exposes the OpenAI-compatible API across multiple model families
      // (Gemini, GPT, etc.). max_tokens is the most universally supported field;
      // reasoning_effort is GPT-5-only and is intentionally not forwarded here.
      max_tokens: max_completion_tokens ?? 16384,
      ...(response_format ? { response_format } : {}),
    });

    const content = (completion as any).choices?.[0]?.message?.content ?? '';
    res.status(200).json({ content });
  } catch (e: any) {
    console.error('meinGPT request failed:', e?.status, e?.message || e);
    const status = typeof e?.status === 'number' ? e.status : 500;
    res.status(status).json({ error: e?.message || 'meinGPT request failed' });
  }
}
