import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { LoginDto, RegisterDto } from '../schemas/auth.schemas';
import { User } from '../entities/user.entity';
import { Role } from '../enums/role.enum';
import jwtConfig from '../config/jwt.config';
import { HashingService } from '../hashing/hashing.service';
import type { ActiveUserData } from '../interfaces/active-user-data.interface';
import {
  InvalidatedRefreshTokenError,
  RefreshTokenIdsStorage,
} from './refresh-token-ids.storage';

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  role: Role;
}

@Injectable()
export class AuthenticationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly hashingService: HashingService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly refreshTokenIdsStorage: RefreshTokenIdsStorage,
  ) {}

  async signUp(dto: RegisterDto): Promise<IssuedTokens> {
    const existing = await this.userRepo.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException('Email déjà utilisé');
    }

    const passwordHash = await this.hashingService.hash(dto.password);
    const user = this.userRepo.create({
      email: dto.email,
      name: dto.name,
      password: passwordHash,
    });
    await this.userRepo.save(user);

    return this.generateTokens(user);
  }

  async signIn(dto: LoginDto): Promise<IssuedTokens> {
    const user = await this.userRepo.findOneBy({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const valid = await this.hashingService.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    return this.generateTokens(user);
  }

  async refreshTokens(presentedRefreshToken: string): Promise<IssuedTokens> {
    try {
      const { sub, refreshTokenId } = await this.jwtService.verifyAsync<
        Pick<ActiveUserData, 'sub'> & { refreshTokenId: string }
      >(presentedRefreshToken, {
        secret: this.jwtConfiguration.refreshSecret,
      });
      const user = await this.userRepo.findOneByOrFail({ id: sub });
      await this.refreshTokenIdsStorage.validate(user.id, refreshTokenId);
      await this.refreshTokenIdsStorage.invalidate(user.id);
      return this.generateTokens(user);
    } catch (err) {
      if (err instanceof InvalidatedRefreshTokenError) {
        throw new UnauthorizedException('Accès refusé');
      }
      throw new UnauthorizedException();
    }
  }

  async signOut(userId: string): Promise<void> {
    await this.refreshTokenIdsStorage.invalidate(userId);
  }

  private async generateTokens(user: User): Promise<IssuedTokens> {
    const refreshTokenId = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.signToken<Pick<ActiveUserData, 'email' | 'role' | 'plan'>>(
        user.id,
        this.jwtConfiguration.accessTokenTtl,
        this.jwtConfiguration.secret,
        { email: user.email, role: user.role, plan: user.plan },
      ),
      this.signToken<{ refreshTokenId: string }>(
        user.id,
        this.jwtConfiguration.refreshTokenTtl,
        this.jwtConfiguration.refreshSecret,
        { refreshTokenId },
      ),
    ]);
    await this.refreshTokenIdsStorage.insert(user.id, refreshTokenId);
    return {
      accessToken,
      refreshToken,
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }

  private signToken<T extends object>(
    userId: string,
    expiresIn: string | undefined,
    secret: string | undefined,
    payload: T,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, ...payload },
      { secret, expiresIn: expiresIn as never },
    );
  }
}
