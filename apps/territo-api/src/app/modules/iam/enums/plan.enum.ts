export const Plan = {
  Free: 'free',
  Artisan: 'artisan',
  Pro: 'pro',
  Enterprise: 'enterprise',
} as const;

export type Plan = (typeof Plan)[keyof typeof Plan];
