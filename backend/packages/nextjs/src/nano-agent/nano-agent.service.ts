import axios from 'axios';

import { FlowLogger } from '../logger/logger';
import { FlowNode } from '../dto/config.dto';
import { NanoAgentException } from '../exceptions/exceptions';
import {
  AIProvider,
  NANO_AGENT_MAX_TOKENS,
  NANO_AGENT_PROMPT_TEMPLATE,
  PROVIDER_CONFIGS,
} from '../constants';

const LOGGER_CONTEXT = 'NanoAgentService';

export class NanoAgentService {
  private readonly apiKey: string;
  private readonly provider: AIProvider;

  constructor(apiKey: string, provider: AIProvider = 'anthropic') {
    this.apiKey = apiKey;
    this.provider = provider;
  }

  async summarize(node: FlowNode): Promise<string> {
    const prompt = this.buildPrompt(node);
    FlowLogger.debug(LOGGER_CONTEXT, 'Requesting AI summary', { nodeId: node.id, provider: this.provider });

    const { url, body, headers } = this.buildRequest(prompt);

    try {
      const response = await axios.post(url, body, { headers });
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

  private buildRequest(prompt: string): { url: string; body: object; headers: Record<string, string> } {
    const config = PROVIDER_CONFIGS[this.provider];

    if (this.provider === 'anthropic') {
      return {
        url: config.apiUrl,
        body: { model: config.defaultModel, max_tokens: NANO_AGENT_MAX_TOKENS, messages: [{ role: 'user', content: prompt }] },
        headers: { 'x-api-key': this.apiKey, 'anthropic-version': config.anthropicVersion!, 'content-type': 'application/json' },
      };
    }

    if (this.provider === 'gemini') {
      return {
        url: `${config.apiUrl}/${config.defaultModel}:generateContent?key=${this.apiKey}`,
        body: { contents: [{ parts: [{ text: prompt }] }] },
        headers: { 'content-type': 'application/json' },
      };
    }

    // openai and openrouter share the OpenAI-compatible format
    return {
      url: config.apiUrl,
      body: { model: config.defaultModel, max_tokens: NANO_AGENT_MAX_TOKENS, messages: [{ role: 'user', content: prompt }] },
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
