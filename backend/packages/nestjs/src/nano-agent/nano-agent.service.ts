import axios from 'axios';

import { FlowLogger } from '../logger/flow-logger';
import { FlowNode } from '../dto/flow-mapper-config.dto';
import { NanoAgentException } from '../exceptions/flow-mapper.exceptions';
import {
  NANO_AGENT_MODEL,
  NANO_AGENT_MAX_TOKENS,
  NANO_AGENT_API_URL,
  NANO_AGENT_ANTHROPIC_VERSION,
  NANO_AGENT_PROMPT_TEMPLATE,
} from '../constants';

const LOGGER_CONTEXT = 'NanoAgentService';

export class NanoAgentService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async summarize(node: FlowNode): Promise<string> {
    const prompt = this.buildPrompt(node);
    FlowLogger.debug(LOGGER_CONTEXT, 'Requesting AI summary', { nodeId: node.id });

    try {
      const response = await axios.post(
        NANO_AGENT_API_URL,
        {
          model: NANO_AGENT_MODEL,
          max_tokens: NANO_AGENT_MAX_TOKENS,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': NANO_AGENT_ANTHROPIC_VERSION,
            'content-type': 'application/json',
          },
        },
      );

      const summary: string = (response.data?.content?.[0]?.text ?? '').trim();
      FlowLogger.debug(LOGGER_CONTEXT, 'Received AI summary', { nodeId: node.id, summary });
      return summary;
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.error?.message ?? err.message)
        : (err as Error).message;
      throw new NanoAgentException(node.id, message);
    }
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
