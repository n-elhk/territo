import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class PostgisRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async runQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      return await runner.query(sql, params);
    } finally {
      await runner.release();
    }
  }
}
