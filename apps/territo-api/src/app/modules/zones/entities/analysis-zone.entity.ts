import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ZoneType } from '../../../common/enums/zone-type.enum';

@Entity('analysis_zones')
export class AnalysisZone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: Object.values(ZoneType) })
  zoneType!: ZoneType;

  @Column()
  name!: string;

  @Column({ nullable: true })
  communeCode!: string;

  // Polygone PostGIS — géré en SQL brut via PostgisRepository pour les requêtes spatiales
  @Column({ type: 'geometry', nullable: true })
  geom!: string | null;

  @Column({ nullable: true })
  parentZoneId!: string | null;
}
