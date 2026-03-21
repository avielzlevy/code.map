import axios from 'axios';

import { FlowLogger } from '../logger/flow-logger';
import { FlowNode } from '../dto/flow-mapper-config.dto';
import { NanoAgentException } from '../exceptions/flow-mapper.exceptions';
import {
  AIProvider,
  NANO_AGENT_MAX_TOKENS,
  NANO_AGENT_MAX_RETRIES,
  NANO_AGENT_RETRY_BASE_MS,
  NANO_AGENT_PROMPT_TEMPLATE,
  PROVIDER_CONFIGS,
} from '../constants';

const LOGGER_CONTEXT = 'NanoAgentService';

export class NanoAgentService {
  private readonly apiKey: string;
  private readonly provider: AIProvider;
  private readonly model: string | undefined;

  constructor(apiKey: string, provider: AIProvider = 'anthropic', model?: string) {
    this.apiKey = apiKey;
    this.provider = provider;
    this.model = model;
  }

  async summarize(node: FlowNode): Promise<string> {
    const prompt = this.buildPrompt(node);
    FlowLogger.debug(LOGGER_CONTEXT, 'Requesting AI summary', { nodeId: node.id, provider: this.provider });

    const { url, body, headers } = this.buildRequest(prompt);

    try {
      const response = await this.withRetry(() => axios.post(url, body, { headers }), node.id);
      const summary = this.parseResponse(response.data);
      FlowLogger.debug(LOGGER_CONTEXT, 'Received AI summary', { nodeId: node.id, summary });
      return summary;
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.error?.message ?? err.message)
        : (err as Error).message;
      throw new NanoAgentException(node.id, message);
    }
  }

  /**
   * Runs `fn` with exponential backoff + jitter, retrying only on transient
   * errors (network failure, 429 rate-limit, 5xx server errors).
   * Hard failures (4xx except 429) are re-thrown immediately.
   */
  private async withRetry<T>(fn: () => Promise<T>, nodeId: string): Promise<T> {
    for (let attempt = 0; attempt <= NANO_AGENT_MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const isLast = attempt === NANO_AGENT_MAX_RETRIES;
        if (isLast) throw err;

        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          // 4xx errors other than 429 are permanent (bad auth, bad request) — don't retry
          const isTransient = !status || status === 429 || status >= 500;
          if (!isTransient) throw err;
        }

        // Exponential backoff: 500ms, 1000ms, 2000ms + up to 200ms jitter
        const delayMs = NANO_AGENT_RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 200;
        FlowLogger.debug(LOGGER_CONTEXT, 'Transient error — retrying', {
          nodeId,
          attempt: attempt + 1,
          maxRetries: NANO_AGENT_MAX_RETRIES,
          delayMs: Math.round(delayMs),
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error('unreachable');
  }

  private buildRequest(prompt: string): { url: string; body: object; headers: Record<string, string> } {
    const config = PROVIDER_CONFIGS[this.provider];
    const model = this.model ?? config.defaultModel;

    if (this.provider === 'anthropic') {
      return {
        url: config.apiUrl,
        body: { model, max_tokens: NANO_AGENT_MAX_TOKENS, messages: [{ role: 'user', content: prompt }] },
        headers: { 'x-api-key': this.apiKey, 'anthropic-version': config.anthropicVersion!, 'content-type': 'application/json' },
      };
    }

    if (this.provider === 'gemini') {
      return {
        url: `${config.apiUrl}/${model}:generateContent?key=${this.apiKey}`,
        body: { contents: [{ parts: [{ text: prompt }] }] },
        headers: { 'content-type': 'application/json' },
      };
    }

    // openai and openrouter share the OpenAI-compatible format
    return {
      url: config.apiUrl,
      body: { model, max_tokens: NANO_AGENT_MAX_TOKENS, messages: [{ role: 'user', content: prompt }] },
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
    };
  }

  private parseResponse(data: Record<string, unknown>): string {
    if (this.provider === 'anthropic') {
      return ((data?.content as Array<{ text: string }>)?.[0]?.text ?? '').trim();
    }
    if (this.provider === 'gemini') {
      return ((data?.candidates as Array<{ content: { parts: Array<{ text: string }> } }>)?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    }
    // openai and openrouter
    return ((data?.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content ?? '').trim();
  }

  private buildPrompt(node: FlowNode): string {
    const docstringSection = node.docstring ? `JSDoc:\n${node.docstring}\n\n` : '';
    const customTagSection = node.customTag ? `Business intent tag: "${node.customTag}"\n\n` : '';

    return NANO_AGENT_PROMPT_TEMPLATE
      .replace('{CODE}', node.rawBody)
      .replace('{DOCSTRING_SECTION}', docstringSection)
      .replace('{CUSTOM_TAG_SECTION}', customTagSection);
  }
}
