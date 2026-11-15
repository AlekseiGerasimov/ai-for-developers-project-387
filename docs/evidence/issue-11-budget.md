# Бюджет допущенных команд (#11)

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

Для main создан активный ruleset `27320716`: обязательный успешный `check`,
strict_required_status_checks_policy=true. Ранее main не был защищён (GET protection
возвращал Branch not protected). Новое правило добавлено отдельно, без перезаписи
других требований к ревью. Проверка: `gh api repos/AlekseiGerasimov/ai-for-developers-project-387/rulesets/27320716`.
