# Checklist Android de publicacao

## Automatizado neste repositorio

- `npm run android:sync`: gera o bundle web e sincroniza o Capacitor.
- `npm run android:check`: executa testes unitarios e Android Lint.
- `npm run android:bundle`: gera o Android App Bundle de release com R8 e reducao de recursos.
- Icone e splash vem de uma unica fonte: `npm run brand:generate` (`scripts/generate-brand-assets.mjs`) gera `assets/brand/*.svg`, os PNGs-fonte de `assets/`, os vetores Android (foreground, fundo em gradiente, monocromatico, icone de notificacao `ic_stat_workoutpro`, splash `drawable/splash.xml` com cor clara/escura via `values-night`), os mipmaps legados quadrado/redondo (mdpi..xxxhdpi) e os icones PWA (`any`, `maskable`, apple-touch, favicon). Nao use `npx @capacitor/assets generate`: ele recria um PNG de splash por densidade/orientacao/tema e os avisos de duplicacao.
- Backup, transferencia automatica de dados e trafego HTTP aberto ficam desativados.
- O icone adaptativo inclui fallback monocromatico para Android moderno.
- O bundle de release foi validado com R8 e reducao de recursos.

O lint esta em 0 erros e 8 avisos nao bloqueantes (eram 34; nenhum aviso de icone/splash restante). Os 8 sao versao do Gradle, `SDK_INT` obsoleto e recursos legados do template Capacitor.

## Testes em dispositivo (Maestro + instrumentados)

> **Os fluxos APAGAM todos os dados do WorkoutPro no aparelho alvo** (`clearState` = `pm clear`).
> Use um emulador ou um aparelho reserva. Nunca rode no celular com seus treinos reais.

Fluxos em `e2e/maestro/flows` (selecionam por texto e `aria-label`, que o WebView expoe na arvore de acessibilidade):

| Fluxo | Valida |
| --- | --- |
| `01-tabs-smoke` | Abas Hoje, Treinos, Progresso, Saude e Voce. |
| `02-rest-timer-notification` | Cria rotina, inicia, conclui serie, notificacao `Descanso mm:ss` na barra, +15 s, Pular, alerta `Descanso terminado` com o app em segundo plano, finalizar e ver no Historico. |
| `03-background-resume` | Relogio do treino e descanso continuam em segundo plano; apos encerrar o processo a sessao ativa e a notificacao voltam. |
| `04-reminders` | Ativar/desativar lembretes agenda/cancela 7 notificacoes semanais (contagem real via `LocalNotifications.getPending`, exibida em Ajustes) e persiste apos reiniciar. |

Pre-requisitos: Android SDK (`adb`), JDK 21 e o [Maestro CLI](https://docs.maestro.dev) (`maestro` no PATH ou `MAESTRO_BIN=/caminho/maestro`).

Emulador (recomendado):

```sh
sdkmanager "system-images;android-35;google_apis;x86_64" "emulator"
avdmanager create avd -n workoutpro-e2e -k "system-images;android-35;google_apis;x86_64"
emulator -avd workoutpro-e2e -no-snapshot-save &
adb devices                                   # ex.: emulator-5554
npm run test:device -- --device emulator-5554
```

Aparelho reserva (sem dados reais): `npm run test:device -- --device <serial> --allow-physical-device`.

O runner (`scripts/run-device-e2e.mjs`) recusa rodar sem `--device`, exige `--allow-physical-device` para seriais que nao sao de emulador, mostra um aviso e espera 10 s (pule com `--yes`), roda `next build` + `cap sync` + `assembleDebug`, instala o APK so no serial informado e chama `maestro test` com `WORKOUTPRO_E2E_ALLOW_WIPE=1`. Sem essa variavel, cada fluxo falha no primeiro passo (`common/guard-wipe.yaml`) antes de abrir o app. Opcoes: `--skip-build`, `--skip-install`, `--flow e2e/maestro/flows/02-rest-timer-notification.yaml`, `--instrumented` (tambem roda `connectedDebugAndroidTest`), `--dry-run`. Relatorio JUnit e capturas em `test-results/maestro/`.

Testes instrumentados (JUnit4, `android/app/src/androidTest/.../TimerForegroundServiceTest.java`): dirigem o `TimerForegroundService` com as mesmas intents do `TimerPlugin` e conferem a notificacao (relogio do treino, contagem do descanso que termina sozinha, nome/progresso/proximo passo, cancelar descanso, parar o servico) e o registro do plugin no Bridge. Compilar: `cd android && ./gradlew --no-daemon :app:compileDebugAndroidTestJavaWithJavac`; rodar: `ANDROID_SERIAL=emulator-5554 ./gradlew --no-daemon connectedDebugAndroidTest`.

Limites: o lembrete semanal e validado pelo agendamento (nao espera o horario disparar); os textos da barra de notificacao dependem do idioma/launcher do sistema (testado com UI do Android padrao).

## Exige aparelho e conta de publicacao

1. Definir `versionCode` e `versionName` para a versao.
2. Configurar uma keystore de upload fora do repositorio e assinar o bundle.
3. Instalar em aparelho Android 8, Android 13 e Android 16 quando disponiveis.
4. Rodar `npm run test:device` num emulador/aparelho reserva; validar manualmente bloqueio de tela e modo aviao.
5. Validar login Google e deep link `workoutpro://auth/callback` com credenciais de producao.
6. Conferir icone, splash claro/escuro, safe areas, teclado numerico e acessibilidade com fonte ampliada.
7. Publicar primeiro em faixa de teste interno e revisar Android Vitals antes de producao.

Keystore, senhas e `google-services.json` nao devem ser versionados.
