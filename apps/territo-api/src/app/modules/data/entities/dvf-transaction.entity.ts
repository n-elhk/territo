import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum PropertyType {
  Maison = 'maison',
  Appartement = 'appartement',
  Dependance = 'dependance',
  Local = 'local',
  Terrain = 'terrain',
}

@Entity('dvf_transactions')
@Index(['parcelId'])
export class DvfTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'date' })
  mutationDate!: Date;

  @Column({ type: 'numeric' })
  price!: number;

  @Column({ type: 'numeric', nullable: true })
  builtSurface!: number | null;

  @Column({ type: 'numeric', nullable: true })
  landSurface!: number | null;

  @Column({ type: 'enum', enum: Object.values(PropertyType) })
  propertyType!: PropertyType;

  @Index()
  @Column()
  communeCode!: string;

  @Column({ type: 'varchar', nullable: true })
  parcelId!: string | null;

  @Column({ type: 'numeric', nullable: true })
  pricePerM2!: number | null;

  @Column({ type: 'geometry', nullable: true })
  geom!: string | null;
}
