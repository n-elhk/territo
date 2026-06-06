import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Period } from '../../../common/enums/period.enum';
import { ScoreType } from '../../../common/enums/score-type.enum';
import { UserSegment } from '../../../common/enums/user-segment.enum';

@Entity('score_history_snapshots')
@Index(['zoneId', 'scoreType', 'tradeOrCategory', 'period', 'generatedAt'])
export class ScoreHistorySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  zoneId!: string;

  @Column({ type: 'enum', enum: Object.values(ScoreType) })
  scoreType!: ScoreType;

  @Column({ type: 'enum', enum: Object.values(UserSegment), nullable: true })
  userSegment!: UserSegment | null;

  @Column({ nullable: true })
  tradeOrCategory!: string | null;

  @Column({ type: 'enum', enum: Object.values(Period) })
  period!: Period;

  @Column({ type: 'numeric' })
  globalScore!: number;

  @Column({ type: 'jsonb', default: '{}' })
  subScores!: Record<string, number>;

  // Métriques principales utilisées (pour rejouer ou expliquer le score)
  @Column({ type: 'jsonb', default: '{}' })
  metricValues!: Record<string, number | null>;

  @Column({ type: 'timestamp' })
  generatedAt!: Date;

  // Fraîcheur des sources au moment du snapshot
  @Column({ type: 'jsonb', nullable: true })
  sourceFreshness!: Record<string, string> | null;
}
