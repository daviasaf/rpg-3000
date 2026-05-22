import { PrismaClient, FieldCategory, FieldType, SystemVisibility } from '@prisma/client'

const prisma = new PrismaClient()

const systems = [
  {
    name: 'Bushi',
    slug: 'bushi',
    description: 'Sistema samurai autoral com Potencia, Ambicao, Astucia, Fluxo, Mente, PE, armas e manobras.',
    tags: ['samurai', 'narrativo', 'acao'],
    schemaJson: {
      primaryResource: 'vida',
      defaultRoll: '1d20 + atributo',
      categories: ['Atributos', 'Recursos', 'Identidade Bushi']
    },
    fields: [
      ['forca', 'Forca', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['agilidade', 'Agilidade', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['astucia', 'Astucia', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['vida', 'Vida', FieldType.NUMBER, FieldCategory.RESOURCE, 12],
      ['fluxo', 'Fluxo', FieldType.NUMBER, FieldCategory.RESOURCE, 4],
      ['mente', 'Mente', FieldType.NUMBER, FieldCategory.RESOURCE, 4],
      ['historia', 'Historia', FieldType.TEXT, FieldCategory.TEXT_FIELD, '']
    ]
  },
  {
    name: 'D&D 5E',
    slug: 'dnd-5e',
    description: 'Ficha compativel para fantasia heroica com atributos, pericias, recursos, ataques e magias preenchidos manualmente.',
    tags: ['fantasia', 'd20', 'popular'],
    schemaJson: {
      primaryResource: 'pontos_de_vida',
      defaultRoll: '1d20 + atributo',
      categories: ['Atributos', 'Pericias', 'Recursos']
    },
    fields: [
      ['forca', 'Forca', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['destreza', 'Destreza', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['constituicao', 'Constituicao', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['inteligencia', 'Inteligencia', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['sabedoria', 'Sabedoria', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['carisma', 'Carisma', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['pontos_de_vida', 'Pontos de vida', FieldType.NUMBER, FieldCategory.RESOURCE, 10],
      ['classe', 'Classe', FieldType.LIST, FieldCategory.LIST_FIELD, 'Guerreiro', ['Guerreiro', 'Mago', 'Ladino', 'Clerigo']],
      ['historia', 'Historia', FieldType.TEXT, FieldCategory.TEXT_FIELD, '']
    ]
  },
  {
    name: 'Ordem Paranormal',
    slug: 'ordem-paranormal',
    description: 'Ficha compativel para campanhas investigativas sobrenaturais, com atributos, pericias e sanidade.',
    tags: ['terror', 'investigacao', 'brasil'],
    schemaJson: {
      primaryResource: 'sanidade',
      defaultRoll: '1d20 + pericia',
      categories: ['Atributos', 'Pericias', 'Recursos']
    },
    fields: [
      ['forca', 'Forca', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['agilidade', 'Agilidade', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['intelecto', 'Intelecto', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['presenca', 'Presenca', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['vigor', 'Vigor', FieldType.NUMBER, FieldCategory.ATTRIBUTE, 0],
      ['investigacao', 'Investigacao', FieldType.NUMBER, FieldCategory.SKILL, 0],
      ['furtividade', 'Furtividade', FieldType.NUMBER, FieldCategory.SKILL, 0],
      ['vida', 'Vida', FieldType.NUMBER, FieldCategory.RESOURCE, 20],
      ['sanidade', 'Sanidade', FieldType.NUMBER, FieldCategory.RESOURCE, 20]
    ]
  }
] as const

async function main() {
  for (const system of systems) {
    await prisma.system.upsert({
      where: { slug: system.slug },
      update: {},
      create: {
        name: system.name,
        slug: system.slug,
        description: system.description,
        tags: [...system.tags],
        visibility: SystemVisibility.PUBLIC,
        schemaJson: system.schemaJson,
        fields: {
          create: system.fields.map((field, index) => ({
            key: field[0],
            label: field[1],
            type: field[2],
            category: field[3],
            defaultValue: field[4],
            optionsJson: field[5] ?? undefined,
            order: index
          }))
        }
      }
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })

