import { Reflector } from '@nestjs/core';
import type { Role } from '../../enums/role.enum';

export const Roles = Reflector.createDecorator<Role[]>();
