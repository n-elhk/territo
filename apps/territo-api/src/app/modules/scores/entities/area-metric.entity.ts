import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Period } from '../../../common/enums/period.enum';

export enum DataStatus {
  Insufficient = 'insufficient',
  Fragile = 'fragile',
  Exploitable = 'exploitable',
}

export enum ZoneLevelRecommendation {
  Micro = 'micro',
  Iris = 'iris',
  Commune = 'commune',
}

@Entity('area_metrics')
@Index(['zoneId', 'period', 'periodEnd'])
export class AreaMetric {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  zoneId!: string;

  @Column({ type: 'enum', enum: Object.values(Period) })
  period!: Period;

  @Column({ type: 'date' })
  periodStart!: Date;

  @Column({ type: 'date' })
  periodEnd!: Date;

  // --- Urbanisme ---
  @Column({ type: 'numeric', default: 0 })
  permitsCount!: number;

  @Column({ type: 'numeric', default: 0 })
  permitsExtensionCount!: number;

  @Column({ type: 'numeric', default: 0 })
  permitsNewHousingCount!: number;

  @Column({ type: 'numeric', default: 0 })
  permitsDemolitionCount!: number;

  @Column({ type: 'numeric', nullable: true })
  avgCreatedSurface!: number | null;

  @Column({ type: 'numeric', nullable: true })
  permitsCountEvolution!: number | null;

  // --- DVF ---
  @Column({ type: 'numeric', default: 0 })
  salesCount!: number;

  @Column({ type: 'numeric', nullable: true })
  medianPriceM2!: number | null;

  @Column({ type: 'numeric', nullable: true })
  priceM2Evolution!: number | null;

  @Column({ type: 'numeric', nullable: true })
  medianPriceM2VsCommune!: number | null;

  @Column({ type: 'numeric', nullable: true })
  medianPriceM2VsNeighbors!: number | null;

  @Column({ type: 'numeric', nullable: true })
  priceDispersion!: number | null;

  @Column({ type: 'numeric', default: 0 })
  housesSalesCount!: number;

  @Column({ type: 'numeric', default: 0 })
  apartmentsSalesCount!: number;

  @Column({ type: 'numeric', nullable: true })
  salesCountEvolution!: number | null;

  @Column({ type: 'numeric', nullable: true })
  comparableSalesCount!: number | null;

  @Column({ type: 'numeric', nullable: true })
  regularitySalesIndex!: number | null;

  @Column({ type: 'numeric', nullable: true })
  highEndSalesRatio!: number | null;

  // --- DPE ---
  @Column({ type: 'numeric', default: 0 })
  dpeCount!: number;

  @Column({ type: 'numeric', nullable: true })
  dpeEfgRatio!: number | null;

  @Column({ type: 'numeric', nullable: true })
  dpeFgRatio!: number | null;

  @Column({ type: 'numeric', nullable: true })
  dpeEfgRatioEvolution!: number | null;

  // --- Composition du parc ---
  @Column({ type: 'numeric', nullable: true })
  houseRatio!: number | null;

  @Column({ type: 'numeric', nullable: true })
  apartmentRatio!: number | null;

  @Column({ type: 'numeric', nullable: true })
  oldBuildingRatio!: number | null;

  // --- Qualité data ---
  @Column({ type: 'numeric', default: 0 })
  confidenceScore!: number;

  @Column({ type: 'enum', enum: Object.values(DataStatus), default: DataStatus.Insufficient })
  dpeStatus!: DataStatus;

  @Column({ type: 'enum', enum: Object.values(DataStatus), default: DataStatus.Insufficient })
  dvfStatus!: DataStatus;

  @Column({ type: 'enum', enum: Object.values(DataStatus), default: DataStatus.Insufficient })
  urbanismStatus!: DataStatus;

  @Column({ type: 'numeric', default: 0 })
  weakSourcesCount!: number;

  @Column({
    type: 'enum',
    enum: Object.values(ZoneLevelRecommendation),
    default: ZoneLevelRecommendation.Micro,
  })
  recommendedZoneLevel!: ZoneLevelRecommendation;

  // Liste des avertissements qualité data (ex: ["Données DPE insuffisantes"])
  @Column({ type: 'jsonb', default: '[]' })
  qualityWarnings!: string[];
}
