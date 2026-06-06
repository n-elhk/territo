import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Period } from '../../../common/enums/period.enum';
import { ScoreType } from '../../../common/enums/score-type.enum';
import { UserSegment } from '../../../common/enums/user-segment.enum';
import { ZoneType } from '../../../common/enums/zone-type.enum';

@Entity('scoring_quality_rules')
export class ScoringQualityRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: Object.values(ScoreType), nullable: true })
  scoreType!: ScoreType | null;

  @Column({ type: 'enum', enum: Object.values(UserSegment), nullable: true })
  userSegment!: UserSegment | null;

  @Column({ type: 'enum', enum: Object.values(ZoneType), nullable: true })
  zoneType!: ZoneType | null;

  @Column({ type: 'enum', enum: Object.values(Period), nullable: true })
  period!: Period | null;

  // Seuils DPE
  @Column({ type: 'numeric', default: 10 })
  minDpeCount!: number;

  @Column({ type: 'numeric', default: 20 })
  strongDpeCount!: number;

  // Seuils DVF
  @Column({ type: 'numeric', default: 5 })
  minSalesCount!: number;

  @Column({ type: 'numeric', default: 10 })
  strongSalesCount!: number;

  // Seuils urbanisme
  @Column({ type: 'numeric', default: 5 })
  minPermitsCount!: number;

  // Seuils de confiance pour affichage
  @Column({ type: 'numeric', default: 70 })
  minConfidenceVisible!: number;

  @Column({ type: 'numeric', default: 40 })
  minConfidenceGreyed!: number;

  @Column({ default: true })
  active!: boolean;

  @Column({ default: '1.0' })
  version!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
