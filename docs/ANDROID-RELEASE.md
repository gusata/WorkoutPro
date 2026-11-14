# Checklist Android de publicacao

## Automatizado neste repositorio

- `npm run android:sync`: gera o bundle web e sincroniza o Capacitor.
- `npm run android:check`: executa testes unitarios e Android Lint.
- `npm run android:bundle`: gera o Android App Bundle de release com R8 e reducao de recursos.
- Icones adaptativos e splashes claro/escuro foram regenerados a partir dos assets em `assets/`.
- Backup, transferencia automatica de dados e trafego HTTP aberto ficam desativados.
- O icone adaptativo inclui fallback monocromatico para Android moderno.
- O bundle de release foi validado com R8 e reducao de recursos.

O lint esta em 0 erros e 30 avisos nao bloqueantes. Os cinco PNGs-fonte atuais sao identicos; para eliminar avisos de densidade/duplicacao preservando qualidade, substitua-os por artes definitivas e independentes antes da publicacao final.

## Exige aparelho e conta de publicacao

1. Definir `versionCode` e `versionName` para a versao.
2. Configurar uma keystore de upload fora do repositorio e assinar o bundle.
3. Instalar em aparelho Android 8, Android 13 e Android 16 quando disponiveis.
4. Validar notificacao, timer em segundo plano, bloqueio de tela, retomada apos encerramento e modo aviao.
5. Validar login Google e deep link `workoutpro://auth/callback` com credenciais de producao.
6. Conferir icone, splash claro/escuro, safe areas, teclado numerico e acessibilidade com fonte ampliada.
7. Publicar primeiro em faixa de teste interno e revisar Android Vitals antes de producao.

Keystore, senhas e `google-services.json` nao devem ser versionados.
