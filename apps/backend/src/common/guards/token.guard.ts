import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Общий guard для защищённых endpoint'ов.
 * Требует заголовок x-ingestion-token, совпадающий с INGESTION_TOKEN из env.
 * Если INGESTION_TOKEN пустой — endpoint закрыт (безопасный дефолт).
 * Сравнение constant-time (защита от timing side-channel).
 */
@Injectable()
export class TokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const headerValue = request.headers['x-ingestion-token'];
    const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const expected = this.configService.get<string>('INGESTION_TOKEN', '');

    // Если токен не настроен — endpoint закрыт
    if (!expected) {
      return false;
    }

    const a = Buffer.from(token ?? '', 'utf8');
    const b = Buffer.from(expected, 'utf8');
    // timingSafeEqual требует равную длину; при несовпадении длины сравниваем
    // с самим собой, чтобы время ответа не раскрывало длину ожидаемого токена.
    return a.length === b.length && timingSafeEqual(a, b);
  }
}