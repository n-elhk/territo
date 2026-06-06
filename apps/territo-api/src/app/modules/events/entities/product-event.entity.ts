import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ScoreType } from '../../../common/enums/score-type.enum';
import { UserSegment } from '../../../common/enums/user-segment.enum';

export enum ProductEventName {
  ZoneDetailOpened = 'zone_detail_opened',
  SubscoresOpened = 'subscores_opened',
  ZoneCompared = 'zone_compared',
  ZoneSaved = 'zone_saved',
  ZoneExported = 'zone_exported',
  AlertCreated = 'alert_created',
  MarketNoteGenerated = 'market_note_generated',
  CredibilityFeedbackSubmitted = 'credibility_feedback_submitted',
  WillingnessToPaySubmitted = 'willingness_to_pay_submitted',
}

@Entity('product_events')
@Index(['userId'])
@Index(['eventName'])
@Index(['createdAt'])
export class ProductEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ type: 'enum', enum: Object.values(ProductEventName) })
  eventName!: ProductEventName;

  @Column({ type: 'enum', enum: Object.values(UserSegment), nullable: true })
  userSegment!: UserSegment | null;

  @Column({ type: 'varchar', nullable: true })
  zoneId!: string | null;

  @Column({ type: 'enum', enum: Object.values(ScoreType), nullable: true })
  scoreType!: ScoreType | null;

  // Métadonnées libres (métier, rayon, période, score, action)
  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
