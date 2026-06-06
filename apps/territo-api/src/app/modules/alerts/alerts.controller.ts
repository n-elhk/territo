import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import type { ActiveUserData } from '../iam/interfaces/active-user-data.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createAlertSchema, type CreateAlertDto } from './schemas/alerts.schemas';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une alerte territoriale' })
  create(
    @ActiveUser() user: ActiveUserData,
    @Body(new ZodValidationPipe(createAlertSchema)) dto: CreateAlertDto,
  ) {
    return this.alertsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: "Lister les alertes de l'utilisateur" })
  findAll(@ActiveUser() user: ActiveUserData) {
    return this.alertsService.findAllByUser(user.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprimer une alerte' })
  delete(
    @ActiveUser() user: ActiveUserData,
    @Param('id') id: string,
  ) {
    return this.alertsService.delete(user.sub, id);
  }
}
