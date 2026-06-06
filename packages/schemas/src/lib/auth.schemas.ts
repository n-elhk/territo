import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email('Email invalide'),
  name: z.string().min(1, 'Nom requis').optional(),
  password: z.string().min(8, 'Mot de passe trop court (8 caractères minimum)'),
});

export const loginSchema = z.object({
  email: z.email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
