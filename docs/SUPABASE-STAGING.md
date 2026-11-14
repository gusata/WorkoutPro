# Validacao Supabase em staging

Use um projeto separado de producao e aplique `supabase/schema.sql`. Crie duas contas de teste diferentes e defina as variaveis abaixo somente no terminal da execucao:

```text
SUPABASE_STAGING_URL
SUPABASE_STAGING_ANON_KEY
SUPABASE_STAGING_USER_A_EMAIL
SUPABASE_STAGING_USER_A_PASSWORD
SUPABASE_STAGING_USER_B_EMAIL
SUPABASE_STAGING_USER_B_PASSWORD
```

Execute `npm run test:supabase:staging`. O teste cria um treino descartavel para o usuario A, confirma que o usuario B nao consegue le-lo nem gravar em nome de A e remove o registro no final. Nenhuma service role key deve ser usada.

Para o ensaio funcional em dois aparelhos:

1. Conecte a mesma conta nos dois aparelhos e sincronize ambos.
2. Edite o mesmo treino offline nos dois lados.
3. Reconecte primeiro o aparelho A e depois o B.
4. Confirme que o conflito aparece por entidade e que cada registro aceita decisao local ou nuvem.
5. Sincronize novamente os dois aparelhos e compare treino, historico, medidas e perfil.

Credenciais de staging nunca devem entrar em `.env.local`, commits, screenshots ou diagnosticos exportados.
