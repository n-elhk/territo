import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum EnergyClass {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
  G = 'G',
}

export enum HousingType {
  Maison = 'maison',
  Appartement = 'appartement',
  ImmeubleCollectif = 'immeuble_collectif',
}

@Entity('dpe_diagnostics')
@Index(['energyClass'])
export class DpeDiagnostic {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Numéro DPE pseudonymisé — jamais le numéro brut.
  // Clé naturelle ADEME : unique pour garantir l'idempotence des imports.
  @Column({ type: 'varchar', nullable: true, unique: true })
  dpeNumberHash!: string | null;

  @Index()
  @Column({ type: 'date' })
  diagnosticDate!: Date;

  @Column({ type: 'enum', enum: Object.values(EnergyClass) })
  energyClass!: EnergyClass;

  @Column({ type: 'enum', enum: Object.values(EnergyClass), nullable: true })
  gesClass!: EnergyClass | null;

  @Column({ type: 'enum', enum: Object.values(HousingType) })
  housingType!: HousingType;

  @Column({ type: 'numeric', nullable: true })
  builtSurface!: number | null;

  @Column({ type: 'varchar', nullable: true })
  constructionPeriod!: string | null;

  // Adresse pseudonymisée — pas de nom ni numéro brut
  @Column({ type: 'varchar', nullable: true })
  addressHash!: string | null;

  @Index()
  @Column()
  communeCode!: string;

  @Column({ type: 'varchar', nullable: true })
  parcelId!: string | null;

  @Column({ type: 'geometry', nullable: true })
  geom!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sourceUpdatedAt!: Date | null;

  @Column({ type: 'numeric', default: 1.0 })
  confidenceLevel!: number;
}
