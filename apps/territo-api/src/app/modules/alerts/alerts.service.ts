import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreateAlertDto } from './schemas/alerts.schemas';
import { Alert, AlertType } from './entities/alert.entity';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) {}

  async create(userId: string, dto: CreateAlertDto): Promise<Alert> {
    const alert = this.alertRepo.create({
      userId,
      alertType: dto.alert_type,
      scoreType: dto.score_type,
      frequency: dto.frequency,
      minScore: dto.min_score ?? null,
      minTrendDelta: dto.min_trend_delta ?? null,
      ...(dto.alert_type === AlertType.LocalRadius
        ? {
            baseLocationLat: dto.base_location.lat,
            baseLocationLng: dto.base_location.lng,
            radiusKm: dto.radius_km,
            tradeOrCategory: dto.trade ?? null,
          }
        : {
            territoryCode: dto.territory_code,
            tradeOrCategory: (dto as { category?: string }).category ?? null,
          }),
    });
    return this.alertRepo.save(alert);
  }

  async findAllByUser(userId: string): Promise<Alert[]> {
    return this.alertRepo.find({
      where: { userId, active: true },
      order: { createdAt: 'DESC' },
    });
  }

  async delete(userId: string, alertId: string): Promise<void> {
    const alert = await this.alertRepo.findOneBy({ id: alertId, userId });
    if (!alert) throw new NotFoundException('Alerte introuvable');
    await this.alertRepo.remove(alert);
  }
}
