# WorkoutPro

Aplicativo local-first para planejar treinos, registrar séries, controlar descanso e acompanhar evolução. A interface é uma exportação estática do Next.js; os dados ficam no IndexedDB, podem ser usados sem conta e, opcionalmente, sincronizados com Supabase. O mesmo bundle é empacotado para Android com Capacitor.

O fluxo de treino inclui valores da sessão anterior, metas por exercício, progressão dupla transparente, tipos de série, RIR/RPE, superséries, descanso por exercício, notas de máquina, substituição de exercício e calculadora de anilhas. A área Progresso reúne comparações de período, gráficos, calendário e conquistas. Backups JSON continuam sendo o formato completo; CSV Strong/Hevy é suportado para interoperabilidade.

## Começar

```bash
npm install
npm run dev
```

O Supabase é opcional. Para habilitar login Google, backup em nuvem e sincronização entre aparelhos, crie `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Depois aplique [supabase/schema.sql](supabase/schema.sql) no projeto Supabase. Sem essas variáveis, todo o fluxo local continua disponível e a tela de perfil explica que a nuvem está desabilitada.

## Qualidade e build

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
npm run test:visual
npm audit
```

Os testes E2E e de regressão visual constroem e servem `out/` automaticamente. Para a auditoria estrutural ampliada em tema claro, escuro, mobile e desktop, mantenha `npm run serve:static` aberto em outro terminal e execute:

```bash
npm run audit:visual
```

O build web é exportado para `out/`. Para Android:

```bash
npm run android:sync
npm run android:check
npm run android:bundle
npm run android
```

`android:sync` gera o build e o copia para o projeto Capacitor. `android:check` executa testes unitários e Android Lint. `android:bundle` valida R8/redução de recursos e gera o AAB de release.

Para validar RLS com duas contas reais antes de publicar, siga [docs/SUPABASE-STAGING.md](docs/SUPABASE-STAGING.md). O checklist de loja está em [docs/ANDROID-RELEASE.md](docs/ANDROID-RELEASE.md).

## Documentação

- [Base de conhecimento](docs/BASE-DE-CONHECIMENTO.md): arquitetura, entidades, fluxos, sincronização, Android e operação.
- [Revisão e alterações](docs/REVISAO-DE-CODIGO.md): achados originais, correções aplicadas, validações e riscos residuais.
