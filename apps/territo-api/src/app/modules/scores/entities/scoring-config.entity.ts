import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ScoreType } from '../../../common/enums/score-type.enum';
import { UserSegment } from '../../../common/enums/user-segment.enum';

@Entity('scoring_configs')
export class ScoringConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: Object.values(ScoreType) })
  scoreType!: ScoreType;

  @Column({ type: 'enum', enum: Object.values(UserSegment), nullable: true })
  userSegment!: UserSegment | null;

  @Column({ nullable: true })
  tradeOrCategory!: string | null;

  @Column()
  version!: string;

  // Pondérations des sous-scores (ex: { "renovation_need": 0.20, "recent_sales": 0.20, ... })
  @Column({ type: 'jsonb' })
  weights!: Record<string, number>;

  // Seuils de normalisation calculés sur le territoire pilote (percentiles)
  @Column({ type: 'jsonb', nullable: true })
  thresholds!: Record<string, { min: number; max: number }> | null;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
