import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum ProjectType {
  PC = 'PC', // Permis de construire
  DP = 'DP', // Déclaration préalable
  PA = 'PA', // Permis d'aménager
  PD = 'PD', // Permis de démolir
}

export enum WorkCategory {
  Extension = 'extension',
  ConstructionNeuve = 'construction_neuve',
  Demolition = 'demolition',
  Renovation = 'renovation',
  ChangementDestination = 'changement_destination',
  Surelevation = 'surelevation',
  DivisionLogement = 'division_logement',
  Autre = 'autre',
}

@Entity('urbanisme_projects')
@Index(['decisionDate'])
@Index(['projectType'])
export class UrbanismeProject {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  sourceId!: string;

  @Index()
  @Column()
  communeCode!: string;

  @Column({ nullable: true })
  communeName!: string;

  @Column({ type: 'varchar', nullable: true })
  parcelId!: string | null;

  @Column({ type: 'enum', enum: Object.values(ProjectType) })
  projectType!: ProjectType;

  @Column({ type: 'enum', enum: Object.values(WorkCategory) })
  workCategory!: WorkCategory;

  @Column({ type: 'date', nullable: true })
  decisionDate!: Date | null;

  @Column({ type: 'date', nullable: true })
  filingDate!: Date | null;

  @Column({ type: 'date', nullable: true })
  openingDate!: Date | null;

  @Column({ type: 'date', nullable: true })
  completionDate!: Date | null;

  @Column({ type: 'numeric', nullable: true })
  surfaceCreated!: number | null;

  @Column({ type: 'numeric', nullable: true })
  surfaceExisting!: number | null;

  @Column({ type: 'varchar', nullable: true })
  destination!: string | null;

  @Column({ type: 'geometry', nullable: true })
  geom!: string | null;

  @Column({ type: 'numeric', default: 1.0 })
  confidenceLevel!: number;
}
