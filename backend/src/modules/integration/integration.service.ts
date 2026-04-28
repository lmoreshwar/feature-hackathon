import { Injectable } from '@nestjs/common';
import { IntegrationDocument } from '../../common/schemas';
import { encryptSecret, maskSecret } from '../../common/utils/crypto.util';
import { UpsertIntegrationDto } from './dto/upsert-integration.dto';
import { IntegrationRecord } from './integration.interface';
import {
  IntegrationRepository,
  IntegrationUpdate,
} from './integration.repository';

interface MaskedIntegration {
  _id: string;
  userId: string;
  jira?: { baseUrl: string; email: string; apiTokenMasked: string } | null;
  confluence?:
    | { baseUrl: string; email: string; apiTokenMasked: string }
    | null;
  llm?:
    | {
        provider: 'OPENAI' | 'AZURE_OPENAI' | 'ANTHROPIC';
        apiKeyMasked: string;
        model: string;
      }
    | null;
  git?:
    | {
        provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
        repoUrl: string;
        tokenMasked: string;
        branch: string;
      }
    | null;
  browserstack?: { username: string; accessKeyMasked: string } | null;
  createdAt: number;
  updatedAt: number;
}

@Injectable()
export class IntegrationService {
  constructor(
    private readonly integrationRepository: IntegrationRepository,
  ) {}

  async getMine(userId: string): Promise<MaskedIntegration | null> {
    const found = await this.integrationRepository.findByUserId(userId);
    return found ? this.toMasked(found) : null;
  }

  async upsertMine(
    userId: string,
    dto: UpsertIntegrationDto,
  ): Promise<MaskedIntegration> {
    const update: IntegrationUpdate = {};

    if (dto.jira) {
      update.jira = {
        baseUrl: dto.jira.baseUrl.trim(),
        email: dto.jira.email.toLowerCase().trim(),
        apiTokenEncrypted: encryptSecret(dto.jira.apiToken),
      };
    }
    if (dto.confluence) {
      update.confluence = {
        baseUrl: dto.confluence.baseUrl.trim(),
        email: dto.confluence.email.toLowerCase().trim(),
        apiTokenEncrypted: encryptSecret(dto.confluence.apiToken),
      };
    }
    if (dto.llm) {
      update.llm = {
        provider: dto.llm.provider,
        apiKeyEncrypted: encryptSecret(dto.llm.apiKey),
        model: dto.llm.model.trim(),
      };
    }
    if (dto.git) {
      update.git = {
        provider: dto.git.provider,
        repoUrl: dto.git.repoUrl.trim(),
        tokenEncrypted: encryptSecret(dto.git.token),
        branch: dto.git.branch.trim(),
      };
    }
    if (dto.browserstack) {
      update.browserstack = {
        username: dto.browserstack.username.trim(),
        accessKeyEncrypted: encryptSecret(dto.browserstack.accessKey),
      };
    }

    const saved = await this.integrationRepository.upsert(userId, update);
    return this.toMasked(saved);
  }

  async clearSection(
    userId: string,
    section: 'jira' | 'confluence' | 'llm' | 'git' | 'browserstack',
  ): Promise<MaskedIntegration | null> {
    const updated = await this.integrationRepository.clear(userId, section);
    return updated ? this.toMasked(updated) : null;
  }

  private toMasked(doc: IntegrationDocument): MaskedIntegration {
    const obj = doc.toObject() as Record<string, unknown>;
    const jira = obj.jira as
      | { baseUrl: string; email: string; apiTokenEncrypted: string }
      | null;
    const confluence = obj.confluence as
      | { baseUrl: string; email: string; apiTokenEncrypted: string }
      | null;
    const llm = obj.llm as
      | {
          provider: 'OPENAI' | 'AZURE_OPENAI' | 'ANTHROPIC';
          apiKeyEncrypted: string;
          model: string;
        }
      | null;
    const git = obj.git as
      | {
          provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
          repoUrl: string;
          tokenEncrypted: string;
          branch: string;
        }
      | null;
    const browserstack = obj.browserstack as
      | { username: string; accessKeyEncrypted: string }
      | null;

    return {
      _id: doc._id.toString(),
      userId: obj.userId as string,
      jira: jira
        ? {
            baseUrl: jira.baseUrl,
            email: jira.email,
            apiTokenMasked: maskSecret(jira.apiTokenEncrypted),
          }
        : null,
      confluence: confluence
        ? {
            baseUrl: confluence.baseUrl,
            email: confluence.email,
            apiTokenMasked: maskSecret(confluence.apiTokenEncrypted),
          }
        : null,
      llm: llm
        ? {
            provider: llm.provider,
            apiKeyMasked: maskSecret(llm.apiKeyEncrypted),
            model: llm.model,
          }
        : null,
      git: git
        ? {
            provider: git.provider,
            repoUrl: git.repoUrl,
            tokenMasked: maskSecret(git.tokenEncrypted),
            branch: git.branch,
          }
        : null,
      browserstack: browserstack
        ? {
            username: browserstack.username,
            accessKeyMasked: maskSecret(browserstack.accessKeyEncrypted),
          }
        : null,
      createdAt: obj.createdAt as number,
      updatedAt: obj.updatedAt as number,
    };
  }
}
