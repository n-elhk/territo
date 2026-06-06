import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Plan } from '../enums/plan.enum';
import { Role } from '../enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  name!: string;

  @Column()
  password!: string;

  @Column({ type: 'enum', enum: Object.values(Role), default: Role.User })
  role!: Role;

  @Column({ type: 'enum', enum: Object.values(Plan), default: Plan.Free })
  plan!: Plan;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
