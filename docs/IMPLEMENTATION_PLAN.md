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
   - добавить готовый пример `mcp-config.json` для GitHub/npx;
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

Цель этапа: расширить распознавание оберток компонентов без ослабления базового правила scanner: компонент должен иметь имя с uppercase и JSX в фактической реализации, кроме специальных случаев вроде `lazy`.

1. Зафиксировать текущие правила до рефакторинга:
   - проверить, что `memo`, `React.memo`, `forwardRef`, `React.forwardRef` уже описаны в `docs/REFERENCE.md`;
   - добавить недостающие regression-тесты на `React.memo(...)` и `React.forwardRef(...)`, если они не покрыты fixtures;
   - добавить negative fixture с uppercase variable/function без JSX, чтобы защитить текущее правило detection.
2. Вынести распознавание wrappers из `componentNodeUtils.ts` в отдельный модуль:
   - создать сервис для разбора wrapper call chain, например `componentWrapperUtils.ts`;
   - оставить публичные helpers `getComponentFunction`, `getComponentPropsParameter`, `getComponentImplementationNode` без изменения контрактов;
   - покрыть новый helper unit/fixture-тестами через существующий scanner API, без тестирования приватных AST-деталей.
3. Поддержать вложенные wrappers:
   - `memo(forwardRef((props, ref) => <... />))`;
   - `forwardRef(memo((props) => <... />))`, только если это реально нужно и fixture подтверждает ожидаемое поведение;
   - `React.memo(React.forwardRef((props, ref) => <... />))`;
   - смешанные формы `memo(React.forwardRef(...))` и `React.memo(forwardRef(...))`.
4. Ограничить список допустимых wrappers:
   - базовый allowlist: `memo`, `React.memo`, `forwardRef`, `React.forwardRef`;
   - новые HOC добавлять только отдельным пунктом после fixture и документации;
   - не считать произвольный `withSomething(Component)` компонентом без явного решения, потому что это быстро дает false positives.
5. Сохранить корректное извлечение props:
   - для `memo(...)` брать первый параметр внутренней функции;
   - для `forwardRef(...)` брать первый параметр внутренней функции, игнорируя `ref`;
   - проверить, что nested wrappers не ломают props extraction в `list_components` и `get_component`.
6. Добавить fixtures в `tests/fixtures/react-project`:
   - отдельный компонент для nested `memo(forwardRef(...))`;
   - отдельный компонент для `React.memo(React.forwardRef(...))`;
   - компонент с props, чтобы проверить извлечение props из nested wrapper;
   - negative fixture с обычной функцией/HOC без JSX, которая не должна попасть в список компонентов.
7. Обновить tests в `tests/searchComponents.test.ts`:
   - расширить тест detection wrapped components новыми именами;
   - добавить проверку props для nested wrapper;
   - добавить negative assertion, что non-component fixture не возвращается из `listComponents`.
8. Обновить `docs/REFERENCE.md`:
   - перечислить точный allowlist wrappers;
   - добавить примеры nested wrappers;
   - уточнить, что произвольные HOC не поддерживаются без явной поддержки и тестов.
9. Выполнить проверки:
   - `npm test`;
   - `npm run build`.

Готово, когда nested wrappers корректно находятся scanner, props извлекаются из внутренней функции, negative fixtures не попадают в список компонентов, `docs/REFERENCE.md` отражает точный allowlist, тесты и build проходят.

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
