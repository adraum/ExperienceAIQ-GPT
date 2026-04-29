import { AzureOpenAI } from 'openai';
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
  reasoning_effort?: 'low' | 'medium' | 'high';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-nano';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';

  if (!endpoint || !apiKey) {
    res.status(500).json({
      error:
        'Azure OpenAI is not configured. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in the Vercel project environment variables.',
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

  const { messages, response_format, max_completion_tokens, reasoning_effort } = body || ({} as AiRequestBody);

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages must be a non-empty array' });
    return;
  }

  const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

  try {
    const completion = await client.chat.completions.create({
      model: deployment,
      messages,
      max_completion_tokens: max_completion_tokens ?? 16384,
      ...(response_format ? { response_format } : {}),
      ...(reasoning_effort ? { reasoning_effort } : {}),
    });

    const content = completion.choices?.[0]?.message?.content ?? '';
    res.status(200).json({ content });
  } catch (e: any) {
    console.error('Azure OpenAI request failed:', e?.message || e);
    res.status(500).json({ error: e?.message || 'Azure OpenAI request failed' });
  }
}
