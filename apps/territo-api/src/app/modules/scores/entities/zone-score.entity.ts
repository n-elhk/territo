import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Period } from '../../../common/enums/period.enum';
import { ScoreType } from '../../../common/enums/score-type.enum';
import { ScoreVisibility } from '../../../common/enums/score-visibility.enum';
import { TrendLabel } from '../../../common/enums/trend-label.enum';
import { UserSegment } from '../../../common/enums/user-segment.enum';

@Entity('zone_scores')
@Index(['zoneId', 'scoreType', 'userSegment', 'period'])
@Index(['scoreType', 'userSegment', 'period', 'globalScore'])
export class ZoneScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  zoneId!: string;

  @Column({ type: 'enum', enum: Object.values(ScoreType) })
  scoreType!: ScoreType;

  @Column({ type: 'enum', enum: Object.values(UserSegment), nullable: true })
  userSegment!: UserSegment | null;

  // Métier ou catégorie (ex: "menuisier", "isolation", "couvreur")
  @Column({ nullable: true })
  tradeOrCategory!: string | null;

  @Column({ type: 'enum', enum: Object.values(Period) })
  period!: Period;

  @Column({ type: 'date' })
  periodStart!: Date;

  @Column({ type: 'date' })
  periodEnd!: Date;

  @Column({ type: 'numeric' })
  globalScore!: number;

  // Sous-scores stockés en JSONB : { "renovation_need": 88, "work_signals": 76, ... }
  @Column({ type: 'jsonb', default: '{}' })
  subScores!: Record<string, number>;

  @Column({ type: 'numeric', nullable: true })
  trendScore!: number | null;

  @Column({ type: 'numeric', nullable: true })
  globalScoreDeltaPrevious!: number | null;

  @Column({ type: 'numeric', nullable: true })
  globalScoreDeltaYear!: number | null;

  @Column({ type: 'enum', enum: Object.values(TrendLabel), nullable: true })
  trendLabel!: TrendLabel | null;

  @Column({ type: 'numeric', default: 0 })
  confidenceScore!: number;

  @Column({ type: 'enum', enum: Object.values(ScoreVisibility), default: ScoreVisibility.Hidden })
  scoreVisibility!: ScoreVisibility;

  @Column({ type: 'numeric', default: 0 })
  weakSourcesCount!: number;

  @Column({ type: 'jsonb', default: '[]' })
  qualityWarnings!: string[];

  // Zone de repli si la maille initiale est trop fragile
  @Column({ nullable: true })
  fallbackZoneId!: string | null;

  // Raisons principales du score (ex: ["DPE E/F/G supérieur à la médiane", "forte activité d'extensions"])
  @Column({ type: 'jsonb', default: '[]' })
  explanation!: string[];

  @Column({ type: 'timestamp' })
  generatedAt!: Date;
}
