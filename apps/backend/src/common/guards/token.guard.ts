import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Общий guard для защищённых endpoint'ов.
 * Требует заголовок x-ingestion-token, совпадающий с INGESTION_TOKEN из env.
 * Если INGESTION_TOKEN пустой — endpoint закрыт (безопасный дефолт).
 */
@Injectable()
export class TokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers['x-ingestion-token'];
    const expected = this.configService.get<string>('INGESTION_TOKEN', '');

    // Если токен не настроен — endpoint закрыт
    if (!expected) {
      return false;
    }

    return token === expected;
  }
}