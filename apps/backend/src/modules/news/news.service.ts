// Сервис доменной модели новостей
// Работает через TypeOrmRepository (Repository<News>) — Sprint 1

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  // Обновление полей новости
  async update(id: string, data: Partial<News>): Promise<News | null> {
    await this.newsRepository.update(id, data);
    return this.findById(id);
  }

  // Обновление статуса новости (переход по пайплайну)
  async updateStatus(id: string, status: NewsStatus): Promise<News | null> {
    return this.update(id, { status });
  }

  // Подсчёт количества новостей по статусу
  async countByStatus(status: NewsStatus): Promise<number> {
    return this.newsRepository.count({ where: { status } });
  }

  // Удаление новости
  async remove(id: string): Promise<void> {
    await this.newsRepository.delete(id);
    this.logger.log(`News removed: ${id}`, this.context);
  }
}