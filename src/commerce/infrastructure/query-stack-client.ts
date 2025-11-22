import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class QueryStackClient {
  private readonly queryUrl = process.env.QUERY_APP_BACKEND_URL;

  constructor(private readonly httpService: HttpService) {}

  public async getMetrics(filter: any): Promise<any> {
    const { commerceId, from, to } = filter;
    const url = `${this.queryUrl}/metrics/notify?commerceId=${commerceId}&from=${from}&to=${to}`;
    return (await firstValueFrom(this.httpService.get(url))).data;
  }
}
