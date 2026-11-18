# Companion Wear OS

App para o relógio (Galaxy Watch e outros com Wear OS 3+, API 30+) que registra séries do treino em andamento no celular.

## O que faz

- Sem treino ativo: "Abra um treino no celular" e o botão **Iniciar treino de hoje** (o celular escolhe o mesmo treino sugerido no Dashboard: agendado para hoje e ainda não feito, senão o feito há mais tempo).
- Com treino ativo: exercício, série N de M, carga × reps (metas do celular e série anterior), `−`/`+` de carga (passo = incremento da regra de progressão do exercício, padrão 2,5 kg) e de reps. Toque no valor para selecioná-lo e gire a coroa/bezel para ajustar; sem seleção, a coroa rola a tela.
- **Série feita**: o celular marca a série, aplica carga/reps e inicia o descanso do exercício. O relógio mostra a contagem regressiva (mesmo horário de término do celular), **+15 s** e **Pular**, a próxima série e a frequência cardíaca do sensor do relógio. A tela fica acesa durante o descanso e vibra ao terminar.
- **Finalizar** pede confirmação e finaliza a sessão no celular (mesmo fluxo do botão Finalizar).
- Ongoing Activity (ícone no mostrador e em Recentes) enquanto o treino roda, e um Tile "Treino atual".
- Modo ambiente: tela preta, sem botões e sem segundos.

## Arquitetura

| Lado | Peça | Papel |
| --- | --- | --- |
| Web | `lib/wearBridge.ts` | Monta o estado (`buildWearState`), debounce + deduplicação (`createStatePusher`), valida e aplica ações (`parseNativeAction`, `applyWearAction`). |
| Web | `components/layout/WearSync.tsx` | Montado no `AppShell`; só roda em Android. Assina `useSessionStore`/`useTimerStore` e liga as ações às stores. |
| Celular | `WearBridgePlugin.kt` | `pushState` → DataItem `/workout/state`; `drainActions` → fila pendente; evento `actionsAvailable`. |
| Celular | `WearActionListenerService.kt` | Recebe mensagens do relógio mesmo com o app fechado e grava em `SharedPreferences` (`WearActionStore`). Se o app não estiver vivo e o pedido for "iniciar", mostra uma notificação para abrir o app. |
| Relógio | `android/wear` | Compose for Wear OS (Material 3), Health Services (MeasureClient), Ongoing Activity, Tile. |

Protocolo (Wearable Data Layer):

- Celular → relógio: DataItem `/workout/state` com `json` (estado de `buildWearState`) e `updatedAt`.
- Relógio → celular: mensagens com JSON e `id` único: `/workout/set-done {sessionId, exerciseId, setId, weight, reps}`, `/workout/rest {sessionId, op: "extend", seconds: 15 | op: "skip"}`, `/workout/start {}`, `/workout/finish {sessionId}`.
- Ações de outra sessão, com mais de 6 h, ou "iniciar" com mais de 10 min são ignoradas. Se a série indicada já foi feita no celular, a ação vale para a série pendente atual.
- A fila é drenada no evento nativo, ao voltar para o app (`visibilitychange`) e na inicialização; depois disso o estado é reenviado.

O relógio mostra uma atualização otimista logo após o toque; o próximo estado publicado pelo celular a substitui.

## Build

```sh
npm run android:wear        # APK debug: android/wear/build/outputs/apk/debug/wear-debug.apk
cd android && ./gradlew --no-daemon :wear:assembleRelease
```

O módulo é incluído em `android/settings.gradle` (não em `capacitor.settings.gradle`, que `npx cap sync` regenera).

**Assinatura:** o Data Layer só conecta apps com o mesmo `applicationId` **e a mesma chave**. Em debug os dois módulos usam `~/.android/debug.keystore`, então funciona sem configurar nada (instale os dois APKs debug gerados na mesma máquina). Em release, assine celular e relógio com a mesma keystore.

## Instalar no relógio (depuração sem fio)

1. No relógio: Configurações → Sobre o relógio → Software → toque 7× em "Versão do software" para ativar o modo desenvolvedor.
2. Configurações → Opções do desenvolvedor → ative **Depuração ADB** e **Depurar por Wi‑Fi** (relógio e computador na mesma rede Wi‑Fi).
3. Em "Depurar por Wi‑Fi" → **Parear novo dispositivo**: anote IP:porta de pareamento e o código.
4. No computador:

   ```sh
   adb pair IP_DO_RELOGIO:PORTA_DE_PAREAMENTO   # digite o código mostrado no relógio
   adb connect IP_DO_RELOGIO:PORTA_DE_DEPURACAO  # a porta exibida na tela "Depurar por Wi-Fi" (não a de pareamento)
   adb devices                                   # confirme o relógio na lista
   adb -s IP_DO_RELOGIO:PORTA_DE_DEPURACAO install -r android/wear/build/outputs/apk/debug/wear-debug.apk
   ```

5. Instale também o app do celular **debug** gerado na mesma máquina (mesma chave). Abra o app do celular uma vez.
6. No relógio, abra o WorkoutPro e permita sensores (frequência cardíaca) e notificações.

Use sempre `-s` com o serial do relógio quando o celular também estiver conectado ao adb.

## Verificar no aparelho real

Nada disto pode ser testado sem o relógio: pareamento do Data Layer, latência das mensagens, permissão de frequência cardíaca (BODY_SENSORS até Wear OS 5, `health.READ_HEART_RATE` no Wear OS 6), sensibilidade da coroa/bezel (`ROTARY_STEP_PX`), Ongoing Activity no mostrador, Tile, modo ambiente e vibração ao fim do descanso.
