import { z } from 'zod';

export const UpdateSettingsSchema = z.object({
  garage_name: z.string().min(1).max(100).optional(),
  garage_address: z.string().max(300).optional(),
  garage_phone: z.string().max(20).optional(),
  garage_logo_url: z.string().url().optional().or(z.literal('')),
  max_concurrent_cars: z.number().int().min(1).max(50).optional(),
  working_hours: z.string().max(100).optional(),
  overseer_whatsapp_number: z.string().max(20).optional(),
  require_diagnosis_approval: z.enum(['true', 'false']).optional(),
  require_client_approval: z.enum(['true', 'false']).optional(),
  currency_label: z.string().max(10).optional(),
  session_timeout_hours: z.number().int().min(1).max(168).optional(),
});

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

// Default system settings
export const DEFAULT_SETTINGS: Record<string, string> = {
  garage_name: 'Garage Sagman',
  garage_address: '',
  garage_phone: '',
  garage_logo_url: '',
  max_concurrent_cars: '5',
  working_hours: 'Mon-Sat 08:00-18:00',
  overseer_whatsapp_number: '',
  require_diagnosis_approval: 'true',
  require_client_approval: 'true',
  currency_label: 'DH',
  session_timeout_hours: '8',
};
