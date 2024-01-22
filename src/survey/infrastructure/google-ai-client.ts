
import { HttpService } from '@nestjs/axios';
import { Injectable } from "@nestjs/common";
import { firstValueFrom } from 'rxjs';
import { AiAnalyzerClient } from './ai-analyzer';

@Injectable()
export class GoogleAiClient implements AiAnalyzerClient {

  private readonly googleAiLanguageUrl = process.env.GOOGLE_AI_LANGUAGE_URL;
  private readonly googleAiLanguageApiKey = process.env.GOOGLE_AI_LANGUAGE_API_KEY;

  constructor(
    private readonly httpService: HttpService
  ) {}

  async analyzeCommentScore(message: string, method: string, type: string): Promise<any> {
    let analysis;
    let score = 0;

    if (message && message != '' && message.length > 0) {
      const url = `${this.googleAiLanguageUrl}documents:${method}?key=${this.googleAiLanguageApiKey}`;
      const body = {
        document: {
          content: message,
          type: type
        },
        encodingType: 'UTF8'
      };
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      }
      try {
        analysis = (await firstValueFrom(this.httpService.post(url, body, config))).data;
        if (analysis && analysis.documentSentiment) {
          score = analysis.documentSentiment.score;
        }
      } catch (error) {
        analysis = error;
      }
    }

    return { score, ...analysis };
  }


  async analyzeCommentEntities(message: string, method?: string, type?: string): Promise<any> {
    let analysis;
    let result = {};
    if (message && message != '' && message.length > 0) {
      const url = `${this.googleAiLanguageUrl}documents:${method}?key=${this.googleAiLanguageApiKey}`;
      const body = {
        document: {
          content: message,
          type: type
        },
        encodingType: 'UTF8'
      };
      const config = {
        headers: {
          'Content-Type': 'application/json'
        }
      }

      try {
        analysis = (await firstValueFrom(this.httpService.post(url, body, config))).data;
        const { entities } = analysis;
        result = entities.map(entity => {
          if (entity) {
            const entityFulfilled = {};
            entityFulfilled['name'] = entity.name;
            entityFulfilled['type'] = entity.type
            entityFulfilled['salience'] = entity.salience || 0;
            entityFulfilled['score'] = 0;
            if (entity.sentiment) {
              entityFulfilled['score'] = entity.sentiment.score || 0;
            }
            return entityFulfilled;
          }
        });
      } catch (error) {
        throw new Error(error.message)
      }
    }
    return { result, ...analysis };
  }

}

