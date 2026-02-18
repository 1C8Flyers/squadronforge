import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6)
});

export type LoginInput = z.infer<typeof loginSchema>;

export const tenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(2),
  orgid: z.number().int(),
  unitOnly: z.boolean(),
  timezone: z.string().min(1),
  syncScheduleCron: z.string().min(1),
  credentialsRef: z.string().min(1),
  fileMappingJson: z.record(z.string(), z.string()).optional()
});
