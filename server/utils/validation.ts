import { z } from 'zod'

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome.').max(80),
    username: z.string().trim().min(2, 'Informe um nome de usuario.').max(32).regex(/^[a-zA-Z0-9_.-]+$/, 'Use letras, numeros, ponto, hifen ou underline.').optional(),
    email: z.string().trim().email('Email invalido.').toLowerCase(),
    password: z.string().min(8, 'Use pelo menos 8 caracteres.'),
    confirmPassword: z.string().min(8)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas nao conferem.',
    path: ['confirmPassword']
  })

export const loginSchema = z.object({
  email: z.string().trim().email('Informe um email valido.').toLowerCase(),
  password: z.string().min(1, 'Informe sua senha.')
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Informe um email valido.').toLowerCase()
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(24, 'Token invalido ou incompleto.'),
    password: z.string().min(8, 'Use pelo menos 8 caracteres.'),
    confirmPassword: z.string().min(8, 'Confirme a senha.')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas nao conferem.',
    path: ['confirmPassword']
  })

const fieldType = z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'LIST', 'FORMULA', 'DICE'])
const fieldCategory = z.enum([
  'ATTRIBUTE',
  'SKILL',
  'RESOURCE',
  'STATUS_BAR',
  'TEXT_FIELD',
  'NUMERIC_FIELD',
  'BOOLEAN_FIELD',
  'LIST_FIELD',
  'FORMULA',
  'ROLL_RULE'
])

export const systemFieldSchema = z.object({
  id: z.string().optional(),
  key: z
    .string()
    .trim()
    .min(2, 'A chave precisa ter pelo menos 2 caracteres.')
    .max(64, 'A chave pode ter no maximo 64 caracteres.')
    .regex(/^[a-zA-Z0-9_/-]+$/, 'Use apenas letras, numeros, hifen, barra ou underline.'),
  label: z.string().trim().min(2, 'Informe o nome do campo.').max(80, 'O nome do campo esta muito longo.'),
  type: fieldType,
  category: fieldCategory,
  defaultValue: z.unknown().optional(),
  optionsJson: z.unknown().optional(),
  formula: z.string().trim().max(240).optional().nullable(),
  order: z.number().int().min(0).optional()
})

export const createSystemSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do sistema.').max(80, 'O nome do sistema esta muito longo.'),
  description: z.string().trim().min(8, 'Descreva o sistema em pelo menos 8 caracteres.').max(600, 'A descricao esta muito longa.'),
  avatarUrl: z.string().trim().url('Informe uma URL valida.').optional().or(z.literal('')).nullable(),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  schemaJson: z
    .object({
      primaryResource: z.string().optional(),
      defaultRoll: z.string().optional(),
      notes: z.string().optional(),
      categories: z.array(z.string()).optional(),
      leveling: z.object({
        attributesPerLevel: z.number().int().min(0).max(100).default(1).optional(),
        levelOneAttributeLimit: z.number().int().min(1).max(100).default(5).optional(),
        attributeLimitIncreasePerLevel: z.number().int().min(0).max(100).default(1).optional(),
        maxAttributeLimit: z.number().int().min(1).max(200).default(20).optional(),
        levelOneAttributePoints: z.number().int().min(0).max(200).default(6).optional()
      }).optional(),
      classes: z.array(z.object({
        id: z.string().optional(),
        key: z.string().trim().min(2).max(64),
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(600).optional(),
        maxLevel: z.number().int().min(1).max(100).default(20),
        levels: z.array(z.object({
          level: z.number().int().min(1).max(100),
          changes: z.array(z.object({
            targetKey: z.string().trim().min(1).max(64),
            targetLabel: z.string().trim().min(1).max(80).optional(),
            operation: z.enum(['ADD', 'SET']).default('ADD'),
            value: z.number().default(1),
            note: z.string().trim().max(160).optional()
          })).default([])
        })).default([])
      })).optional()
    })
    .default({}),
  fields: z.array(systemFieldSchema).min(1, 'Crie pelo menos um campo para a ficha.')
})

export const updateSystemSchema = createSystemSchema.partial().extend({
  fields: z.array(systemFieldSchema).optional()
})

export const createCharacterSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do personagem.').max(80, 'O nome do personagem esta muito longo.'),
  description: z.string().trim().max(400).optional().nullable(),
  avatarUrl: z.string().trim().url().optional().or(z.literal('')).nullable(),
  systemId: z.string().min(1),
  dataJson: z.record(z.unknown()).default({})
})

export const updateCharacterSchema = createCharacterSchema.partial()

export const createRoomSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da campanha.').max(100, 'O nome da campanha esta muito longo.'),
  description: z.string().trim().max(800).optional().nullable(),
  systemId: z.string().min(1),
  characterId: z.string().optional().nullable(),
  isPublic: z.boolean().default(false)
})

export const joinRoomSchema = z.object({
  code: z.string().trim().min(4).max(16).toUpperCase(),
  characterId: z.string().min(1)
})

export const updateRoomSchema = createRoomSchema.partial()

export const messageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  characterId: z.string().optional().nullable(),
  type: z.enum(['CHAT', 'SYSTEM', 'EVENT', 'PRIVATE']).default('CHAT'),
  metadataJson: z.record(z.unknown()).optional()
})

export const diceRollSchema = z.object({
  expression: z.string().trim().min(3).max(80),
  characterId: z.string().optional().nullable(),
  mode: z.literal('NORMAL').default('NORMAL'),
  hidden: z.boolean().optional().default(false)
})
