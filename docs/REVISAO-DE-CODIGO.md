# Revisão e alterações do WorkoutPro

> Revisão concluída e correções implementadas em 19/08/2026.

## Resultado executivo

Os riscos críticos encontrados na primeira auditoria foram corrigidos no código: importação não validada, perda de mutações durante sync, foreground service incompatível, finalização não atômica e retomada incorreta do timer. A base agora possui testes automatizados, documentação operacional e uma matriz de validação reproduzível.

## Alterações aplicadas

| Área | Antes | Agora |
|---|---|---|
| Backup | JSON cru podia apagar tudo | Envelope v1, validação completa, preview, confirmação, datas revividas e transação com rollback |
| Fila de sync | Snapshot completo e `clear()` global | Itens por entidade/ID, confirmação individual e substituição imutável da mutação atual |
| Pull | Restore automático destrutivo | Merge protegido; replace somente explícito e confirmado |
| Conflitos | Last-writer sem aviso | Comparação de `updatedAt`, store de conflitos e escolha local/nuvem |
| Offline | Cliente Supabase obrigatório | Aplicativo funciona integralmente sem variáveis de nuvem |
| Logout | Apagava dados locais | Mantém dados; exclusão local virou ação separada e confirmada |
| Sessão | Gravações separadas | Sessão, perfil e fila em transação; `sessionId` estável e fechamento idempotente |
| Perfil | Agregados sem reparo | `reconcileProfile` reconstrói XP, volume, quantidade e streak das sessões |
| XP | PR/streak ignorados | PRs e bônus de sequência entram no fechamento |
| Timer | Recomeçava após reload | Deriva do timestamp persistido e limpa serviço/descanso de forma coordenada |
| Exercícios | Exclusão deixava IDs órfãos | Remove de todas as fichas na mesma transação e enfileira afetados |
| Estatísticas | Semanas parciais/inconsistentes | Segunda–domingo, mês civil e buckets compartilhados |
| UI | Primitivos conflitantes, overlays e navegação cobrindo conteúdo | Componentes nativos restaurados, overlay opt-in e navegação limitada às telas principais |
| Metadados | Título único | Títulos descritivos nas rotas principais |
| Execução | Ordem rígida e finalização ambígua | Progresso geral, reordenação, inputs numéricos e confirmação de séries incompletas |
| Estados | Flash de lista vazia e falhas sem fallback | Carregamento explícito, erro recuperável, feedback `aria-live` e seed transacional |
| Privacidade | Sem diagnóstico controlado | Log local sanitizado, limitado, exportável e apagável pelo usuário |
| Android | Tipo `health` inválido e erros silenciosos | `specialUse`, permissão correta, rejeições ao JS e logs nativos |
| Dependências | Vulnerabilidades altas/crítica transitivas | Next 16.3.1, árvore antiga removida e `npm audit` em 0 |
| Testes | Sem testes JS/TS | 25 testes unitários, 4 E2E e 4 comparações visuais |
| Rotas | Stub exportava `/workouts/_/` | Stub removido; IDs locais continuam na query string compatível com export estático |

## Cobertura adicionada

- parsing, referências, datas e importação atômica de backup;
- fila imutável e full sync sem ID curinga;
- fechamento concorrente/idempotente de sessão;
- atualização única de XP, volume e perfil;
- streak por calendário, incluindo bordas de horário;
- períodos semanal/mensal e buckets;
- retomada de duração e descanso por timestamp;
- integridade ao excluir ou duplicar exercício em ficha.
- detecção e resolução por registro de conflitos de sincronização;
- RLS no schema e verificação integrada opcional com duas contas de staging;
- criação, reload, execução, backup válido e rejeição de backup inválido em navegador real.

## Validações finais

| Comando | Resultado |
|---|---|
| `npm run lint` | Passou sem erros. |
| `npx tsc --noEmit` | Passou sem erros. |
| `npm test` | 9 arquivos e 25 testes aprovados. |
| `npm run build` | Passou em Next 16.3.1; 15 páginas estáticas geradas. |
| `npm audit` | 0 vulnerabilidades. |
| `npm run test:e2e` | 4 fluxos aprovados no bundle de produção. |
| `npm run test:visual` | 4 screenshots comparadas com os baselines. |
| `npm run audit:visual` | 20 capturas, claro/escuro e mobile/desktop, sem overflow, 404 ou erros de console. |
| `npx cap sync android` | Passou; quatro plugins sincronizados. |
| `npm run android:check` | `BUILD SUCCESSFUL`; 0 erros e 30 avisos de assets/legado. |
| `npm run android:bundle` | AAB de release gerado com R8 e redução de recursos. |

## Riscos residuais, sem bloqueio

- O Android Lint mantém 30 avisos não bloqueantes em splashes duplicados/fora de densidade e XMLs legados. Os cinco assets-fonte atuais são cópias da mesma imagem; uma arte-fonte separada para foreground/background/dark é necessária para eliminar esses avisos com qualidade.
- Plugins Capacitor podem emitir notas internas de APIs obsoletas; o código Java próprio não emite mais a nota anterior.
- Sync deve ser ensaiado contra um Supabase de staging depois de aplicar `supabase/schema.sql`; o script com duas contas está pronto, mas depende de credenciais externas.
- Playwright cobre persistência e fluxos locais; sync real e comportamento do timer ainda exigem staging e aparelho Android físico.

## Próxima evolução recomendada

1. Executar a verificação já automatizada em um Supabase de staging com duas contas descartáveis.
2. Fornecer artes independentes de ícone foreground/background, monocromático e splash claro/escuro.
3. Fazer smoke test do AAB em aparelhos Android reais antes da faixa interna da loja.
