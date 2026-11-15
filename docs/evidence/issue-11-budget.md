# Бюджет допущенных команд (#11)

## Реальная проверка отмены и исчерпания

На PR #13 допущены построчная команда (run43742488192) и общая команда
(run43743482797). Учебная третья команда (run43743772311) получила успешный
`Record admitted command`, была отменена с pending opencode без шагов модели.
Четвёртая (run43743922894) получила `PR #13: 4/3 attempts`; Run agent и проверка
ключа были skipped. Счётчик корректно учёл отмену и не вызвал модель.

Но публикация комментария получила HTTP403 Resource not accessible by integration:
issues: write недостаточно для комментария к PR при pull-requests: read.
Это подтверждённый инфраструктурный дефект, а не успешное завершение сценария.
Исправление выносит публикацию полностью в report с pull-requests: write, без
модели, ключа и checkout. У агента права PR остаются read. reason и точный SHA
передаются outputs до остановки; все скриптовые тесты теперь выбираются glob в CI.
Реальный повтор без модели нужно проверить после отдельного решения человека
о правах задания report и мержа исправления в default branch.

Базовая версия политики: `0901ca8f866700654b9dfd4c5bc558c758345bf0`.
Источник счётчика — история Actions. Агент не получает Actions: write.

## RED и GREEN

Новые тесты запущены против извлечённого из базового коммита модуля:

```powershell
$old = git show 0901ca8:.github/scripts/pr-budget.cjs
[IO.File]::WriteAllText((Join-Path $PWD '.cache/evidence/pr-budget-before.cjs'), ($old -join "`n"))
$env:PR_BUDGET_MODULE = (Join-Path $PWD '.cache/evidence/pr-budget-before.cjs')
mise exec -- node --test .github/scripts/pr-budget.test.cjs
Remove-Item Env:PR_BUDGET_MODULE
```

Фактический результат: exit 1; 3 passed, 3 failed. Отказы:

- rejected comments cannot exhaust a trusted human budget: `4 !== 1`;
- rerunning an old workflow cannot bypass newer admitted requests;
- unavailable authorization history fails closed.

С исправленным модулем:

```text
mise exec -- node --test .github/scripts/pr-budget.test.cjs .github/scripts/triage-policy.test.cjs
tests 9; pass 9; fail 0
mise exec -- actionlint
exit 0
```

Читаются все попытки заданий (`filter: all`), чтобы учитывать унаследованный
успешный authorize при Re-run failed jobs. Отмены и тайм-ауты после допуска
расходуют попытку. Сбой API не разрешает модель и теперь не подавляет отчёт infra.

## Исправление по финальному ревью

Успешный `authorize` не доказывает допуск: guard возвращает `allowed=false`
для `/octopus`, URL с `/oc` и комментариев к fork PR без ошибки задания.
Стабильный шаг `Record admitted command` выполняется только при `allowed=true`;
счётчик использует его успешное завершение, включая историю Re-run failed jobs.

RED: регрессия с успешным authorize и пропущенным маркером дала `4 !== 1`
(5 passed, 1 failed). После исправления: 6 passed. Следующий RED проверил
сохранение старого бюджета без маркера: `0 !== 3` (6 passed, 1 failed).
GREEN: оба policy-набора — 10 passed, 0 failed.
`mise exec -- actionlint`, Prettier для четырёх изменённых файлов и
`git diff --check` завершились с exit 0.

Для старых запусков без маркера учитывается начавшийся или завершённый
`Check PR budget` в задании opencode; пропущенный шаг не считается.
Старый допущенный запуск, отменённый до начала этого шага, нельзя отличить
от отклонённого по одной успешной авторизации, поэтому он не учитывается.
В новых запусках маркер сохраняет допуск и при последующей отмене до бюджета.

## Подтверждённый timeout без модели в отчёте

[Запуск implement-spec](https://github.com/AlekseiGerasimov/ai-for-developers-project-387/actions/runs/43737484320)
достиг 15-минутного лимита Run agent. Отдельное задание report завершилось успешно
и опубликовало в issue #3 `нужен человек: timeout`, SHA и ссылку на логи.
Временные worktree раннера не были отправлены в GitHub. Дальнейшая реализация
продолжается локальным implement-spec по исходному поручению пользователя.

## Риск и откат

Ошибка политики влияет на стоимость модели или доступ доверенного человека к агенту.
Поэтому проверяются оба канала, авторизация, отмена, Re-run старого запроса и сбой API.
Откат — revert коммита исправления через PR с CI. Данные приложения не затрагиваются;
но при возврате старой политики возвращаются описанные ошибки бюджетирования.
Владелец проверил настройки GitHub App и сообщил в рабочей сессии 2026-11-15:
«Read access to actions and metadata; Read and write access to code, issues,
and pull requests». Таким образом, токен App также не может удалять историю Actions.
Это подтверждение владельца в чате, а не результат доступного агенту API:
текущий пользовательский токен не позволяет читать установки App.

REST API комментария `6897489545` вернул `user.login=opencode-agent[bot]`, type=Bot.
Именно этот login указан в allowlist авторевью. GraphQL/gh показывал сокращённое
имя `opencode-agent`, которое не совпадает с login в payload события PR.

Для main создан активный ruleset `27320716`: обязательный успешный `check`,
strict_required_status_checks_policy=true. Ранее main не был защищён (GET protection
возвращал Branch not protected). Новое правило добавлено отдельно, без перезаписи
других требований к ревью. Проверка: `gh api repos/AlekseiGerasimov/ai-for-developers-project-387/rulesets/27320716`.
