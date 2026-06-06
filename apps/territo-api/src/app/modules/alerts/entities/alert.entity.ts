import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ScoreType } from '../../../common/enums/score-type.enum';

export enum AlertType {
  LocalRadius = 'local_radius',
  Territory = 'territory',
}

export enum AlertFrequency {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
}

@Entity('alerts')
@Index(['userId'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ type: 'enum', enum: Object.values(AlertType) })
  alertType!: AlertType;

  @Column({ type: 'numeric', nullable: true })
  baseLocationLat!: number | null;

  @Column({ type: 'numeric', nullable: true })
  baseLocationLng!: number | null;

  @Column({ type: 'numeric', nullable: true })
  radiusKm!: number | null;

  @Column({ type: 'varchar', nullable: true })
  territoryCode!: string | null;

  @Column({ type: 'enum', enum: Object.values(ScoreType) })
  scoreType!: ScoreType;

  @Column({ type: 'varchar', nullable: true })
  tradeOrCategory!: string | null;

  @Column({ type: 'numeric', nullable: true })
  minScore!: number | null;

  @Column({ type: 'numeric', nullable: true })
  minTrendDelta!: number | null;

  @Column({ type: 'enum', enum: Object.values(AlertFrequency) })
  frequency!: AlertFrequency;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
