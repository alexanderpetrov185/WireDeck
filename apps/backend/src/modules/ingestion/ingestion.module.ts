import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { CollectorModule } from '../collector/collector.module';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [
    CollectorModule, // РРјРїРѕСЂС‚РёСЂСѓРµРј РјРѕРґСѓР»СЊ СЃР±РѕСЂР°, С‡С‚РѕР±С‹ РїРѕР»СѓС‡РёС‚СЊ РґРѕСЃС‚СѓРї Рє CollectorService
    NewsModule,      // РРјРїРѕСЂС‚РёСЂСѓРµРј РјРѕРґСѓР»СЊ РЅРѕРІРѕСЃС‚РµР№, С‡С‚РѕР±С‹ РїРѕР»СѓС‡РёС‚СЊ РґРѕСЃС‚СѓРї Рє NewsService
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
