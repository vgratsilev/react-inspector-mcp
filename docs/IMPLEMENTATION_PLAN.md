# План реализации улучшений

План составлен по `README.md`, `docs/REFERENCE.md`, `docs/ROADMAP.md` и текущему `package.json`.

## Цели

- Подготовить проект к первому публичному релизу.
- Добавить запуск MCP-сервера из GitHub без ручного клонирования и сборки.
- Улучшить точность графа зависимостей React-компонентов.
- Расширить тестовое покрытие на реальные структуры React-проектов.

## Этап 1. Подготовка публичного репозитория

1. Подготовить репозиторий к переводу в public:
   - проверить отсутствие секретов, токенов и локальных `.env*` в истории и текущем дереве;
   - проверить README, license и ссылки на GitHub;
   - убедиться, что issue/PR settings подходят для публичного проекта.
2. Сделать GitHub-репозиторий публичным.
3. Заполнить metadata в `package.json`:
   - `author`;
   - оставить `"private": true`, пока не принято отдельное решение о публикации в npm;
   - при необходимости `homepage`, `bugs`, дополнительные `keywords`.
4. Проверить соответствие `license` в `package.json` и `LICENSE`.
5. Проверить, что в git не попадают сгенерированные и локальные файлы:
   - `dist/`;
   - `node_modules/`;
   - `.env*`;
   - IDE/agent-specific директории.
6. Обновить `README.md`:
   - оставить быстрый setup;
   - явно отделить production MCP config от dev config;
   - добавить короткий пример вызова tool с `projectPath`.
7. Выполнить финальные проверки:
   - `npm test`;
   - `npm run build`;
   - `git status`.

Готово, когда репозиторий публичный, package metadata заполнены, README не дублирует reference, тесты и build проходят.

## Этап 2. Запуск из GitHub/npx

1. Добавить исполняемый entrypoint:
   - shebang в серверный entrypoint, если нужен для bin;
   - `bin` в `package.json`, например `react-inspector-mcp`.
2. Решить стратегию сборки для запуска из GitHub:
   - не коммитить `dist/`;
   - добавить `prepare`/аналогичный npm lifecycle script для сборки после установки из git;
   - проверить, что dev-зависимости доступны в этом сценарии.
3. Проверить package contents:
   - настроить `files`, если проект будет публиковаться в npm;
   - выполнить `npm pack --dry-run`;
   - убедиться, что в пакет попадают только нужные файлы.
4. Проверить чистую установку:
   - создать временный проект;
   - установить пакет из GitHub;
   - запустить bin;
   - выполнить MCP initialize smoke test.
5. Обновить `README.md` и `docs/REFERENCE.md`:
   - добавить готовый MCP client config для GitHub/npx;
   - описать требования Node.js 20+;
   - оставить локальный dev config отдельным блоком.

Готово, когда MCP-клиент может стартовать сервер через GitHub/npx без ручной сборки.

## Этап 3. Точная резолюция графа зависимостей

1. Перенести граф зависимостей с matching по локальному имени на TypeScript symbol resolution.
2. Построить индекс компонентов по declaration symbol и source location.
3. Использовать один механизм резолюции для:
   - direct imports;
   - alias imports;
   - barrel exports;
   - re-exports.
4. Обновить `get_component_dependencies` и `get_component_dependents`, чтобы они не давали ложные связи при одинаковых именах компонентов в разных файлах.
5. Добавить fixture-тесты:
   - два компонента с одинаковым именем в разных модулях;
   - import alias;
   - barrel export;
   - re-export chain.

Готово, когда граф строится по реальному символу компонента, а не только по JSX tag name.

## Этап 4. Lazy import dependency edges

1. Расширить анализ `lazy(() => import(...))` и `React.lazy`.
2. Резолвить import target через `tsconfig.json`.
3. Определить компонент-цель:
   - default export;
   - named export, если import содержит `.then(...)`;
   - fallback на source file component index, если экспорт неоднозначен.
4. Добавить dependency edge от lazy wrapper к импортируемому компоненту.
5. Отразить новый тип связи в output, если потребуется сохранить обратную совместимость.
6. Добавить fixture-тесты для default и named lazy imports.

Готово, когда lazy wrapper виден как компонент и связывается с фактической импортируемой целью.

## Этап 5. Поддержка более сложных HOC

1. Вынести распознавание wrappers в отдельный модуль.
2. Поддержать вложенные wrappers:
   - `memo(forwardRef(...))`;
   - `React.memo(React.forwardRef(...))`.
3. Добавить ограниченный список дополнительных HOC только при наличии тестовых fixtures.
4. Убедиться, что scanner не начинает считать обычные функции компонентами без JSX.
5. Обновить `docs/REFERENCE.md` с точным списком поддержанных wrappers.

Готово, когда новые HOC покрыты тестами и не ухудшают текущие detection rules.

## Этап 6. Реальные fixture-сценарии

1. Добавить fixtures для распространенных структур:
   - `src/components`;
   - `src/pages`;
   - `src/app`;
   - path aliases из `tsconfig.json`;
   - index barrels.
2. Покрыть scan filters:
   - include только `src/**/*.tsx`;
   - exclude stories/tests;
   - default excludes.
3. Добавить regression tests для:
   - props extraction;
   - JSDoc;
   - usage count;
   - unused risk;
   - dependencies/dependents.
4. Проверить скорость тестов и отсутствие flaky cases.

Готово, когда fixtures ближе к реальным React-проектам и защищают основные сценарии scanner.

## Этап 7. Релиз

1. Перед релизом выполнить:
   - `npm test`;
   - `npm run build`;
   - `npm pack --dry-run`;
   - clean install smoke test.
2. Проверить GitHub Actions CI.
3. Зафиксировать changelog/release notes.
4. Создать git tag первого публичного релиза.
5. После релиза проверить MCP config из README на чистой машине или во временной директории.

Готово, когда tag создан, CI зеленый, README config воспроизводимо запускает MCP-сервер.
