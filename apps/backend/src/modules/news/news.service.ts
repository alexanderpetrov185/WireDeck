// Сервис доменной модели новостей
// Работает через TypeOrmRepository (Repository<News>) — Sprint 1

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { News, NewsStatus } from './entities/news.entity';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class NewsService {
  // Контекст для логирования
  private readonly context = 'NewsService';

  constructor(
    // Инжекция TypeORM-репозитория для сущности News
    @InjectRepository(News)
    private readonly newsRepository: Repository<News>,
    // Глобальный сервис логирования
    private readonly logger: LoggerService,
  ) {}

  // Создание новости из сырого события
  async create(data: Partial<News>): Promise<News> {
    const news = this.newsRepository.create(data);
    const saved = await this.newsRepository.save(news);
    this.logger.log(`News created: ${saved.id}`, this.context);
    return saved;
  }

  // Поиск новости по ID
  async findById(id: string): Promise<News | null> {
    return this.newsRepository.findOne({ where: { id } });
  }

  // Поиск новости по хэшу (для дедупликации)
  async findByHash(hash: string): Promise<News | null> {
    return this.newsRepository.findOne({ where: { hash } });
  }

  // Поиск новости по источнику и ID события в источнике
  async findBySource(source: News['source'], sourceId: string): Promise<News | null> {
    return this.newsRepository.findOne({ where: { source, sourceId } });
  }

  // Получение списка новостей по статусу с пагинацией
  async findByStatus(status: NewsStatus, take = 50, skip = 0): Promise<News[]> {
    return this.newsRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
  }

  /**
   * Получение списка новостей с пагинацией и опциональным фильтром по статусу.
   * Используется NewsController (Sprint 10 Frontend Admin).
   * @param take Максимум записей (limit)
   * @param skip Смещение
   * @param status Опциональный фильтр по статусу
   */
  async findAll(take = 50, skip = 0, status?: NewsStatus): Promise<News[]> {
    const where = status ? { status } : {};
    return this.newsRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
  }

  // Обновление полей новости
  async update(id: string, data: Partial<News>): Promise<News | null> {
    await this.newsRepository.update(id, data);
    return this.findById(id);
  }

  /**
   * Атомарный claim новости для публикации (Sprint 8.5 hardening).
   * Выполняет conditional UPDATE: только если статус APPROVED.
   * Это защищает от дубликатов при конкурентных publish-запросах
   * и от повторной отправки в Telegram, если DB update ранее не прошёл.
   * @param id ID новости
   * @returns true если новость была захвачена (status APPROVED -> PUBLISHED), иначе false
   */
  async claimForPublishing(id: string): Promise<boolean> {
    const result = await this.newsRepository.update(
      { id, status: NewsStatus.APPROVED },
      { status: NewsStatus.PUBLISHED },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Атомарное сохранение telegramMessageId вместе с финальным статусом.
   * Обновляет только новости, уже захваченные для публикации (status PUBLISHED).
   * @param id ID новости
   * @param telegramMessageId ID сообщения в Telegram
   * @returns true, если сообщение сохранено, иначе false
   */
  async markPublished(id: string, telegramMessageId: string): Promise<boolean> {
    const result = await this.newsRepository.update(
      { id, status: NewsStatus.PUBLISHED },
      { telegramMessageId },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Откат claim после неудачной публикации.
   * Возвращает новость в статус APPROVED, только если она была
   * захвачена (PUBLISHED) и telegram ещё не записан (telegram_message_id IS NULL).
   * Это позволяет безопасно повторить публикацию без дубликатов.
   * @param id ID новости
   * @returns true, если откат выполнен, иначе false
   */
  async revertPublishingClaim(id: string): Promise<boolean> {
    const result = await this.newsRepository
      .createQueryBuilder()
      .update(News)
      .set({ status: NewsStatus.APPROVED })
      .where('id = :id', { id })
      .andWhere('status = :status', { status: NewsStatus.PUBLISHED })
      .andWhere('telegram_message_id IS NULL')
      .execute();
    return (result.affected ?? 0) > 0;
  }

  // Обновление статуса новости (переход по пайплайну)
  async updateStatus(id: string, status: NewsStatus): Promise<News | null> {
    return this.update(id, { status });
  }

  // Подсчёт количества новостей по статусу
  async countByStatus(status: NewsStatus): Promise<number> {
    return this.newsRepository.count({ where: { status } });
  }

  /**
   * Застрявшие публикации (Sprint 11, Sprint 8.5 crash window):
   * статус PUBLISHED, telegram_message_id пуст, обновлены раньше порога.
   * ТОЛЬКО чтение — detection/observability, никаких изменений данных.
   * @param olderThanMs Возраст записи (по updatedAt), считающийся "застрявшей"
   */
  async findStuckPublished(olderThanMs: number): Promise<News[]> {
    const threshold = new Date(Date.now() - olderThanMs);
    return this.newsRepository.find({
      where: {
        status: NewsStatus.PUBLISHED,
        telegramMessageId: IsNull(),
        updatedAt: LessThan(threshold),
      },
      order: { updatedAt: 'ASC' },
    });
  }


  // Удаление новости
  async remove(id: string): Promise<void> {
    await this.newsRepository.delete(id);
    this.logger.log(`News removed: ${id}`, this.context);
  }
}