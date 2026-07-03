# Iterative Project Update Plan

Основано на:

- [react-inspector-mcp-review.md](react-inspector-mcp-review.md)
- [REPOSITORY_ANALYSIS.md](REPOSITORY_ANALYSIS.md)
- [ROADMAP.md](ROADMAP.md)

## Главный вывод

Проект уже рабочий: сборка и тесты проходят, MCP-инструменты отвечают, базовый `ts-morph`-резолвинг сделан правильно. Обновления нужно вести не через переписывание ядра, а через короткие итерации:

1. закрепить релизную безопасность;
2. убрать повторные полные сканы;
3. ограничить дорогие ответы;
4. расширить модель компонента и использования;
5. синхронизировать `ROADMAP.md` после каждого этапа.

## Приоритеты

1. **Release safety**: smoke-тест установленного пакета и CI.
2. **Performance**: общий scan context вместо повторных обходов проекта.
3. **Token safety**: лимиты, пагинация, `summary`-режим и управление полями.
4. **Correctness**: более честная семантика `find_unused_components`.
5. **Scanner coverage**: классовые компоненты, HOC, `styled-components`, анонимные default exports, props.
6. **Cache lifecycle**: контролируемое обновление проекта в долгих MCP-сессиях.
7. **Docs/Roadmap**: `ROADMAP.md` должен отражать реальные этапы, а не общий список пожеланий.

## Этап 0. Синхронизация плана и ROADMAP

Цель: превратить текущий короткий `ROADMAP.md` в навигационный документ по ближайшим итерациям.

Работы:

- Добавить в `ROADMAP.md` ссылку на этот план.
- Разделить roadmap на блоки `Now`, `Next`, `Later`.
- Перенести текущий пункт про clean-install smoke test в `Now`.
- Явно указать, что performance, output limits и scanner coverage идут отдельными итерациями.
- Завести правило: после завершения каждого этапа обновлять `ROADMAP.md` и `CHANGELOG.md`, если менялось поведение.

Критерии готовности:

- `ROADMAP.md` отражает порядок этапов из этого файла.
- Нет противоречий между `ROADMAP.md`, `docs/REFERENCE.md` и README.

## Этап 1. Релизная безопасность

Цель: проверить не только исходники, но и пакет так, как его будет запускать MCP-клиент.

Работы:

- Добавить clean-install MCP smoke test:
  - собрать пакет через `npm pack`;
  - установить его во временный проект;
  - запустить сервер как subprocess;
  - проверить `initialize`;
  - проверить `tools/list`;
  - вызвать `list_components` на маленькой React/TypeScript-фикстуре.
- Добавить CI workflow:
  - `npm ci`;
  - `npm test`;
  - `npm run build`;
  - `npm pack --dry-run`.
- Проверить, что smoke test не зависит от локального `dist/`, `node_modules/` и IDE-состояния.

Критерии готовности:

- CI зеленый на чистой установке.
- Smoke test падает при сломанном MCP handshake или отсутствующих tools.
- `ROADMAP.md` обновлен: этап отмечен как текущий/завершенный.

Проверки:

```bash
npm test
npm run build
npm pack --dry-run
```

## Этап 2. Shared ScanContext

Цель: убрать повторные полные обходы проекта в публичных tools.

Работы:

- Ввести общий `ScanContext` на один tool call:
  - `project`;
  - `sourceFiles`;
  - `components`;
  - `ComponentResolver`;
  - usage index;
  - dependency map.
- Перевести `search_components`, `find_unused_components`, dependency/dependent tools на общий контекст.
- Не строить resolver и usage scan заново для каждого компонента.
- Сохранить текущее поведение ответов, чтобы это был performance/refactor этап без изменения API.

Критерии готовности:

- Все существующие тесты проходят без изменения ожидаемого поведения.
- `find_unused_components` и пустой `search_components` делают один полный usage scan за вызов, а не scan на каждый компонент.
- В коде нет параллельных старых путей сканирования, которые снова обходят весь проект.

Проверки:

```bash
npm test
npm run build
```

## Этап 3. Ограничение больших ответов

Цель: снизить риск раздувания контекста при `list_components` и широком `search_components`.

Работы:

- Добавить параметры вывода:
  - `limit`;
  - `offset` или cursor;
  - `fields`;
  - `mode: "summary" | "full"`.
- Вернуть метаданные:
  - `total`;
  - `returned`;
  - `truncated`;
  - `nextOffset`/cursor.
- Ограничить дефолтные широкие ответы безопасным лимитом.
- Для сложных props дать возможность не разворачивать полные типы в summary-режиме.
- Обновить `docs/REFERENCE.md`.

Критерии готовности:

- Широкий `list_components` не возвращает весь проект без явного запроса.
- Старый сценарий полного ответа доступен явно.
- Документация объясняет, какие параметры использовать агенту.

Проверки:

```bash
npm test
npm run build
```

## Этап 4. Более честный `find_unused_components`

Цель: снизить риск ложных удалений.

Работы:

- Разделить usage types:
  - JSX usage;
  - `React.createElement`;
  - value reference;
  - route/config reference;
  - dynamic/unknown reference.
- Добавить в ответ `usageKinds`, `confidence` и более явную `reason`.
- Пересмотреть название/описание риска: инструмент должен показывать "no known usages", а не обещать абсолютную неиспользуемость.
- Добавить фикстуры для:
  - `React.createElement(Comp)`;
  - `component={Comp}`;
  - route config;
  - массивов/объектов с компонентами.
- Обновить `docs/REFERENCE.md`.

Критерии готовности:

- Компонент с non-JSX reference не попадает в high-confidence unused.
- Ответ явно показывает, почему компонент считается рискованным или безопасным кандидатом.

Проверки:

```bash
npm test
npm run build
```

## Этап 5. Расширение scanner coverage

Цель: уменьшить молчаливую неполноту на реальных React-проектах.

Работы:

- Добавить поддержку:
  - class components;
  - алиасов `memo`, `forwardRef`, `lazy`;
  - конфигурируемого HOC allowlist;
  - анонимных default exports;
  - `styled-components`/styled factories как отдельного типа компонента или known limitation с явным флагом.
- Улучшить props extraction:
  - generics;
  - destructuring;
  - default values;
  - `React.FC`;
  - `forwardRef`.
- Добавить fixture tests на каждый новый паттерн.

Критерии готовности:

- Новые паттерны либо корректно детектируются, либо явно маркируются как unsupported/partial.
- Нет молчаливого пропуска для заявленных поддерживаемых паттернов.
- `docs/REFERENCE.md` описывает границы поддержки.

Проверки:

```bash
npm test
npm run build
```

## Этап 6. Cache lifecycle

Цель: сделать долгоживущий MCP-сервер предсказуемым по памяти и свежести данных.

Работы:

- Уточнить cache key:
  - `projectPath`;
  - `tsconfig`;
  - include/exclude filters.
- Обработать добавленные и удаленные файлы в долгой сессии.
- Добавить TTL или явный refresh-механизм.
- Ограничить рост cache для разных проектов.
- Покрыть тестами сценарии "файл добавлен", "файл удален", "фильтры изменились".

Критерии готовности:

- Сервер не держит бесконечно много проектов без ограничений.
- Новые и удаленные файлы корректно отражаются в следующих вызовах.
- Поведение свежести данных задокументировано.

Проверки:

```bash
npm test
npm run build
```

## Этап 7. Agent-facing tools

Цель: дать агентам более дешевые и точные запросы вместо широкого `list/search`.

Работы:

- Добавить combined component report:
  - компонент;
  - props summary;
  - usages;
  - dependencies;
  - dependents;
  - risk/confidence.
- Добавить dependency graph output с управляемой глубиной.
- Добавить compact output для навигации по большому проекту.
- Обновить README только коротким quick usage, детали оставить в `docs/REFERENCE.md`.

Критерии готовности:

- Типовая задача "что это за компонент и кто его использует" решается одним компактным вызовом.
- Новые tools не дублируют огромные ответы существующих tools.

Проверки:

```bash
npm test
npm run build
```

## Этап 8. Release pass

Цель: подготовить стабильный публичный релиз после функциональных изменений.

Работы:

- Проверить `package.json`:
  - `author`;
  - `license`;
  - `private`;
  - `repository`.
- Обновить:
  - `CHANGELOG.md`;
  - `README.md`, если менялся quick usage;
  - `docs/REFERENCE.md`, если менялись tools;
  - `docs/ROADMAP.md`.
- Выполнить полный release checklist.

Критерии готовности:

- Все проверки зеленые.
- `npm pack --dry-run` показывает ожидаемый состав пакета.
- `git status` содержит только осознанные изменения.
- Решение о публикации принято отдельно.

Проверки:

```bash
npm test
npm run build
npm pack --dry-run
git status
```

## Рекомендуемая первая итерация

Начать с Этапа 0 и Этапа 1:

1. обновить `ROADMAP.md` под этот план;
2. добавить clean-install MCP smoke test;
3. добавить CI;
4. только после этого начинать `Shared ScanContext`.

Причина: smoke test и CI быстро снижают риск релизов, а `ScanContext` станет базой для performance, output limits и новых agent-facing tools.
