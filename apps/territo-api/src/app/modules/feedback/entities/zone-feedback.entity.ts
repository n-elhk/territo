import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum CredibilityAnswer {
  Yes = 'yes',
  No = 'no',
  Unsure = 'unsure',
}

export enum FeedbackReason {
  DataInsufficient = 'data_insufficient',
  BadRanking = 'bad_ranking',
  OpaqueScore = 'opaque_score',
  LocalKnowledgeDisagrees = 'local_knowledge_disagrees',
  Other = 'other',
}

@Entity('zone_feedback')
@Index(['userId'])
@Index(['zoneId'])
export class ZoneFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  zoneId!: string;

  @Column()
  scoreId!: string;

  @Column({ type: 'enum', enum: Object.values(CredibilityAnswer) })
  credibilityAnswer!: CredibilityAnswer;

  @Column({ type: 'enum', enum: Object.values(FeedbackReason), nullable: true })
  reason!: FeedbackReason | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
