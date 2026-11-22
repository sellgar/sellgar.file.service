
## Обычное чтение файлов

`file.getAll` и `file.getByUuid` исключают metadata со статусом `deleted` в запросах
к PostgreSQL до пагинации. Удалённый UUID в обычном чтении даёт NotFound.
Внутренний `findForDeletion` сохраняет доступ к tombstone для безопасного повторения
cleanup. Изменения статуса возвращают записанное состояние, включая `deleted`.
Правила удаления папок и связей с другими доменами этим изменением не меняются.

## CI и доставка

Push в `development` запускает unit → build → publish → migrate → deploy.
`unit` — обязательная job с юнит-тестами из Docker target `tests` до сборки приложения.
Если тесты или миграции не прошли, deploy не запускается.
Сборка, тесты и публикация выполняются на GitHub-hosted runners;
migrate/deploy — на общем organization runner в dev VM.
Обычная раскатка выполняется Helm с ожиданием готовности и проверкой image digest.
Argo CD продолжает управлять платформой, но не этим приложением.

Docker targets: `application`, `tests`, `migration`.
Миграционный образ запускает TypeORM CLI отдельной Kubernetes Job до раскатки приложения. В runtime приложения миграции автоматически не запускаются.

Настройки среды хранятся в `helm/dev/values.yaml`, Secret refs — в
`helm/values.app.yaml`. Версионный immutable ConfigMap монтируется через
`environmentFile`; значения credentials не передаются в GitHub-hosted jobs или Git.
Внутренний HTTP-порт — 8080, в dev одна реплика.

PR запускает unit → build без публикации и деплоя. Push в `release/*` публикует
кандидат с `release.json`; ручной production workflow из `master` принимает
`candidate-<run-number>.<attempt>`, проверяет успешный исходный CI и идентичность
дерева, продвигает те же digest без пересборки. Production ещё не подготовлен:
нужны его values, Secrets, runner и GitHub environment protections.
Откат миграций в эту схему не включён.

Общие workflows закреплены тегом `delivery-v0.7.0` в `sellgar.infrastructure`.
Порядок установки runner и передачи управления: [доставка приложений](https://github.com/sellgar/sellgar.infrastructure/blob/development/docs/application-delivery.md).

## Курсорные списки

Самостоятельные списки принимают `{ limit?: number, nextToken?: string, ...filters }`
и возвращают `{ items, meta: { limit, nextToken: string | null } }`.
Размер пачки по умолчанию 50, максимум 100. OFFSET и общее количество удалены;
при продолжении нужно передавать прежние фильтры. Новый фильтр/сортировка — новый
список без токена. Корни выбираются до relations; коллекции карточек и снимков
остаются полными. Последний ключ сортировки — уникальный PK.

Пакет `@sellgar/pagination` подключён через nested submodule; build и unit image
сначала собирают его. `PaginationModule` требует `PAGINATION_TOKEN_SECRET` минимум
32 байта, одинаковый у реплик сервиса. Helm читает его из Secret `file-pagination`,
ключ `token-secret`. Ansible infrastructure создаёт отсутствующие ключи командой
`.venv/bin/ansible-playbook -i inventory/dev.yml secrets.yml --tags pagination` из ansible/
без замены существующих значений. Локально ключ задаётся окружением; в Git его нет.
Отсутствие/слабый ключ блокирует настройку пагинации. HMAC не предоставляет доступ:
ограничения магазина/владельца применяются заново к каждому запросу.
