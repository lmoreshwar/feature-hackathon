import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { decryptSecret } from '../../common/utils/crypto.util';
import { IntegrationRepository } from '../integration/integration.repository';

export type LlmProvider = 'OPENAI' | 'AZURE_OPENAI' | 'ANTHROPIC';

export interface LlmCredentials {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

export interface LlmChatOptions {
  /** When true, instruct the model to return strict JSON. */
  json?: boolean;
  /** Sampling temperature (default 0.2 for deterministic output). */
  temperature?: number;
  /** Soft cap on completion tokens. */
  maxOutputTokens?: number;
}

const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_OUTPUT = 1500;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly integrationRepository: IntegrationRepository) {}

  async getUserCredentials(userId: string): Promise<LlmCredentials | null> {
    const doc = await this.integrationRepository.findByUserId(userId);
    if (!doc) return null;
    const llm = (doc.toObject() as { llm?: { provider: LlmProvider; apiKeyEncrypted: string; model: string } | null }).llm;
    if (!llm || !llm.apiKeyEncrypted) return null;

    return {
      provider: llm.provider,
      apiKey: decryptSecret(llm.apiKeyEncrypted),
      model: llm.model,
    };
  }

  /**
   * Run a single-turn chat completion and return the raw text response.
   * Throws ServiceUnavailableException if the user has not configured an LLM
   * integration. Throws BadRequestException for upstream errors.
   */
  async chat(
    userId: string,
    system: string,
    user: string,
    options: LlmChatOptions = {},
  ): Promise<string> {
    const creds = await this.getUserCredentials(userId);
    if (!creds) {
      throw new ServiceUnavailableException(
        'No LLM integration configured. Add provider/model/API key in Integrations.',
      );
    }
    const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    const maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT;

    if (creds.provider === 'OPENAI') {
      return this.callOpenAi(creds, system, user, temperature, maxOutputTokens, options.json);
    }
    if (creds.provider === 'AZURE_OPENAI') {
      return this.callAzureOpenAi(creds, system, user, temperature, maxOutputTokens, options.json);
    }
    if (creds.provider === 'ANTHROPIC') {
      return this.callAnthropic(creds, system, user, temperature, maxOutputTokens);
    }
    throw new BadRequestException(`Unsupported LLM provider: ${String(creds.provider)}`);
  }

  /** Convenience wrapper: chat with JSON output, parsed. */
  async chatJson<T>(
    userId: string,
    system: string,
    user: string,
    options: Omit<LlmChatOptions, 'json'> = {},
  ): Promise<T> {
    const raw = await this.chat(userId, system, user, { ...options, json: true });
    return this.parseJson<T>(raw);
  }

  private parseJson<T>(raw: string): T {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch (err) {
      this.logger.warn(`LLM returned non-JSON response: ${raw.slice(0, 400)}`);
      throw new BadRequestException(
        'LLM returned an invalid JSON response. Try again or use a different model.',
      );
    }
  }

  private async callOpenAi(
    creds: LlmCredentials,
    system: string,
    user: string,
    temperature: number,
    maxOutputTokens: number,
    json: boolean | undefined,
  ): Promise<string> {
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model: creds.model,
      temperature,
      max_tokens: maxOutputTokens,
      response_format: json ? { type: 'json_object' as const } : undefined,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new BadRequestException(
        `OpenAI API error ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  private async callAzureOpenAi(
    creds: LlmCredentials,
    system: string,
    user: string,
    temperature: number,
    maxOutputTokens: number,
    json: boolean | undefined,
  ): Promise<string> {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-08-01-preview';
    if (!endpoint) {
      throw new BadRequestException(
        'AZURE_OPENAI_ENDPOINT env var must be set for Azure OpenAI integrations.',
      );
    }
    const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(creds.model)}/chat/completions?api-version=${apiVersion}`;
    const body = {
      temperature,
      max_tokens: maxOutputTokens,
      response_format: json ? { type: 'json_object' as const } : undefined,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': creds.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new BadRequestException(
        `Azure OpenAI error ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  private async callAnthropic(
    creds: LlmCredentials,
    system: string,
    user: string,
    temperature: number,
    maxOutputTokens: number,
  ): Promise<string> {
    const url = 'https://api.anthropic.com/v1/messages';
    const body = {
      model: creds.model,
      max_tokens: maxOutputTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: user }],
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': creds.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new BadRequestException(
        `Anthropic API error ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    return text.trim();
  }
}
