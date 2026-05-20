# Central RPG 3000

Aplicacao full-stack para RPG de mesa online com Nuxt 4, Vue 3, TypeScript, Prisma, PostgreSQL, Tailwind, Zod, BCrypt e cookie HTTP-only com JWT.

## Rodar localmente

1. Instale dependencias:

```bash
npm install
```

2. Crie o arquivo `.env` a partir de `.env.example` e configure:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="troque-por-um-segredo-longo"
APP_URL="http://localhost:3000"
```

As variaveis `GMAIL_USER` e `GMAIL_PASS` configuram envio real de email pelo Gmail via Nodemailer. Use uma senha de app do Google em `GMAIL_PASS`. Enquanto Gmail nao estiver configurado em desenvolvimento, a API de esqueci minha senha retorna o link de reset na resposta para facilitar testes locais.

3. Gere o Prisma Client:

```bash
npx prisma generate
```

4. Aplique o schema no banco:

```bash
npx prisma db push
```

5. Rode os seeds iniciais:

```bash
npm run prisma:seed
```

6. Inicie a aplicacao:

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## Funcionalidades

- Login, cadastro, logout e recuperacao de senha com token.
- Senhas com BCrypt e sessao em cookie HTTP-only.
- Sistemas genericos de RPG com campos dinamicos, categorias, recursos, pericias, formulas e regras.
- Personagens renderizados dinamicamente a partir do schema do sistema.
- Salas/campanhas com codigo de convite, mestre e membros.
- Mesa de jogo com chat, log, sessoes, painel de rolagem, iniciativa e notas do mestre.
- Parser de dados para `1d20`, `1d20+5`, `2d6+3`, `1d100-10`, vantagem, desvantagem e critico.
- Seeds: Bushi, D&D 5E e Ordem Paranormal.

## Deploy no Render

1. Crie um PostgreSQL no Render.
2. Copie a connection string para `DATABASE_URL`.
3. Configure `DIRECT_URL` com a mesma URL, a menos que use pooler/connection string direta separada.
4. Configure `JWT_SECRET` com um valor longo e privado.
5. Configure `APP_URL` com a URL publica do servico Render.
6. Configure Gmail quando quiser ativar envio real de email:
   - `GMAIL_USER`
   - `GMAIL_PASS`

Build command:

```bash
npm install && npx prisma generate && npx prisma db push && npm run build
```

Start command:

```bash
node .output/server/index.mjs
```

Para rodar seed no Render, use um job/manual shell:

```bash
npm run prisma:seed
```

## Estrutura principal

- `app/pages`: telas publicas e autenticadas.
- `app/components`: layout, cards, ficha dinamica, builder, chat e rolagem.
- `server/api`: rotas da API.
- `server/utils`: auth, Prisma, validacao, permissoes, dados e email.
- `prisma/schema.prisma`: modelos PostgreSQL.
- `prisma/seed.ts`: sistemas iniciais.

## Comandos uteis

```bash
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run dev
npm run build
```
