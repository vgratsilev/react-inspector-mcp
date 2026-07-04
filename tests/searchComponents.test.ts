import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test, { type TestContext } from "node:test";
import { SourceFile } from "ts-morph";

import {
    findComponentUsages,
    findUnusedComponents,
    getComponent,
    getComponentDependencies,
    getComponentDependents,
    listComponents,
    searchComponents,
} from "../src/tools/searchComponents.js";
import {
    clearProjectCache,
    getProject,
    getProjectCacheStats,
    refreshProjectCache,
} from "../src/services/projectManager.js";
import { shouldIncludeFile } from "../src/services/pathMatcher.js";
import type { PropInfo } from "../src/types/ComponentInfo.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(testDir, "fixtures/react-project");

function normalizePath(value: string): string {
    return value.replace(/\\/g, "/");
}

function sortedNames(values: Array<{ name: string }>): string[] {
    return values.map(value => value.name).sort();
}

function countIncludedSourceFiles(): number {
    const project = getProject(fixturePath);

    return project.getSourceFiles().filter(sourceFile =>
        shouldIncludeFile(fixturePath, sourceFile.getFilePath())
    ).length;
}

async function listAllComponents() {
    return (
        await listComponents(fixturePath, {
            limit: 100,
            mode: "full",
        })
    ).items;
}

async function createFixtureCopy(
    t: TestContext,
    prefix: string
): Promise<string> {
    const workDir = await mkdtemp(join(tmpdir(), prefix));
    const projectPath = join(workDir, "react-project");

    clearProjectCache();
    await cp(fixturePath, projectPath, { recursive: true });
    t.after(async () => {
        clearProjectCache();
        await rm(workDir, { recursive: true, force: true });
    });

    return projectPath;
}

async function writeMinimalReactProject(
    projectPath: string,
    componentName: string
): Promise<void> {
    const srcDir = join(projectPath, "src");

    await mkdir(srcDir, { recursive: true });
    await writeFile(
        join(projectPath, "tsconfig.json"),
        `${JSON.stringify(
            {
                compilerOptions: {
                    jsx: "preserve",
                    target: "ES2023",
                    module: "NodeNext",
                    moduleResolution: "NodeNext",
                    strict: true,
                    skipLibCheck: true,
                },
                include: ["src"],
            },
            null,
            2
        )}\n`,
        "utf8"
    );
    await writeFile(
        join(srcDir, "global.d.ts"),
        [
            "declare namespace JSX {",
            "  interface Element {}",
            "  interface IntrinsicElements {",
            "    div: Record<string, unknown>;",
            "    section: Record<string, unknown>;",
            "  }",
            "}",
            "",
        ].join("\n"),
        "utf8"
    );
    await writeFile(
        join(srcDir, `${componentName}.tsx`),
        [
            `export function ${componentName}() {`,
            "  return <div />;",
            "}",
            "",
        ].join("\n"),
        "utf8"
    );
}

test("limits list_components by default", async () => {
    const result = await listComponents(fixturePath);

    assert.equal(result.items.length, 20);
    assert.equal(result.returned, 20);
    assert.equal(result.truncated, true);
    assert.equal(result.nextOffset, 20);
    assert.ok(result.total > result.returned);
});

test("paginates list_components with limit and offset", async () => {
    const allComponents = await listComponents(fixturePath, {
        limit: 100,
        mode: "full",
    });
    const page = await listComponents(fixturePath, {
        limit: 3,
        offset: 2,
        mode: "full",
    });

    assert.equal(page.returned, 3);
    assert.equal(page.total, allComponents.total);
    assert.deepEqual(
        page.items.map(component => component.name),
        allComponents.items.slice(2, 5).map(component => component.name)
    );
});

test("returns compact props in summary mode", async () => {
    const result = await searchComponents(fixturePath, "Button");
    const button = result.items.find(component =>
        component.name === "Button"
    );
    const prop = Array.isArray(button?.props)
        ? button.props[0]
        : undefined;

    assert.ok(button);
    assert.equal(button.usageCount, 4);
    assert.ok(prop);
    assert.equal("type" in prop, false);
    assert.equal("usedIn" in button, false);
});

test("returns full component fields in full mode", async () => {
    const result = await searchComponents(fixturePath, "Button", {
        mode: "full",
    });
    const button = result.items.find(component =>
        component.name === "Button"
    );
    const prop = Array.isArray(button?.props)
        ? button.props[0]
        : undefined;

    assert.ok(button);
    assert.ok(button.declaration);
    assert.ok(Array.isArray(button.usedIn));
    assert.ok(prop);
    assert.equal("type" in prop, true);
});

test("filters broad component fields", async () => {
    const result = await listComponents(fixturePath, {
        fields: ["name"],
        limit: 1,
    });
    const component = result.items[0];

    assert.ok(component);
    assert.deepEqual(Object.keys(component), ["name"]);
});

test("lists detected React components with props and metadata", async () => {
    const components = await listAllComponents();
    const button = components.find(component => component.name === "Button");

    assert.ok(button);
    assert.equal(button.exported, true);
    assert.equal(button.defaultExport, false);
    assert.equal(button.description, "Shared action button.");
    assert.ok(button.declaration.filePath.endsWith("src/components/Button.tsx"));
    assert.ok(button.declaration.line > 0);
    assert.ok(button.declaration.column > 0);
    assert.deepEqual(
        button.props.map(prop => ({
            name: prop.name,
            optional: prop.optional,
        })),
        [
            { name: "title", optional: false },
            { name: "disabled", optional: true },
            { name: "variant", optional: false },
        ]
    );
});

test("lists app route components with props and JSDoc metadata", async () => {
    const components = await listAllComponents();
    const names = sortedNames(components);
    const appShell = components.find(component =>
        component.name === "AppShell"
    );
    const rootLayout = components.find(component =>
        component.name === "RootLayout"
    );
    const appHomePage = components.find(component =>
        component.name === "AppHomePage"
    );

    assert.ok(names.includes("AppShell"));
    assert.ok(names.includes("RootLayout"));
    assert.ok(names.includes("AppHomePage"));
    assert.ok(names.includes("DashboardPage"));
    assert.ok(appShell);
    assert.equal(appShell.description, "Application shell used by app routes.");
    assert.ok(normalizePath(appShell.path).endsWith("src/app/layout.tsx"));
    assert.deepEqual(
        appShell.props.map(prop => ({
            name: prop.name,
            optional: prop.optional,
        })),
        [
            { name: "title", optional: false },
            { name: "compact", optional: true },
        ]
    );
    assert.equal(rootLayout?.defaultExport, true);
    assert.ok(normalizePath(appHomePage?.path ?? "").endsWith("src/app/page.tsx"));
});

test("detects wrapped memo, forwardRef, and lazy components", async () => {
    const components = await listAllComponents();
    const names = components.map(component => component.name);
    const memoBadge = components.find(component =>
        component.name === "MemoBadge"
    );
    const lazyPanel = components.find(component =>
        component.name === "LazyPanel"
    );

    assert.ok(names.includes("MemoBadge"));
    assert.ok(names.includes("ForwardInput"));
    assert.ok(names.includes("NestedMemoForwardRef"));
    assert.ok(names.includes("ReactNestedMemoForwardRef"));
    assert.ok(names.includes("MixedMemoForwardRef"));
    assert.ok(names.includes("MixedReactMemoForwardRef"));
    assert.ok(names.includes("LazyPanel"));
    assert.ok(names.includes("LazyDefaultPanel"));
    assert.ok(names.includes("LazyNamedPanel"));
    assert.equal(memoBadge?.kind, "wrapped");
    assert.equal(lazyPanel?.kind, "lazy");
});

test("detects class components, anonymous defaults, and styled factories", async () => {
    const components = await listAllComponents();
    const classPanel = components.find(component =>
        component.name === "ClassPanel"
    );
    const anonymousDefault = components.find(component =>
        component.name === "AnonymousDefault"
    );
    const styledBox = components.find(component =>
        component.name === "StyledBox"
    );
    const styledWrappedBox = components.find(component =>
        component.name === "StyledWrappedBox"
    );
    const styledAttrsButton = components.find(component =>
        component.name === "StyledAttrsButton"
    );

    assert.equal(classPanel?.kind, "class");
    assert.deepEqual(
        classPanel?.props.map(prop => ({
            name: prop.name,
            optional: prop.optional,
        })),
        [
            { name: "title", optional: false },
            { name: "compact", optional: true },
        ]
    );
    assert.equal(anonymousDefault?.kind, "function");
    assert.equal(anonymousDefault?.defaultExport, true);
    assert.deepEqual(
        anonymousDefault?.props.map(prop => ({
            name: prop.name,
            optional: prop.optional,
            defaultValue: prop.defaultValue,
        })),
        [
            {
                name: "label",
                optional: true,
                defaultValue: "\"Generated\"",
            },
        ]
    );
    assert.equal(styledBox?.kind, "styled");
    assert.equal(styledWrappedBox?.kind, "styled");
    assert.equal(styledAttrsButton?.kind, "styled");
});

test("detects arbitrary configured HOC wrappers", async () => {
    const defaultComponents = await listAllComponents();
    const configured = await listComponents(fixturePath, {
        componentWrappers: ["arbitraryHoc"],
        limit: 100,
        mode: "full",
    });
    const defaultNames = defaultComponents.map(component => component.name);
    const configuredHocPanel = configured.items.find(component =>
        component.name === "ConfiguredHocPanel"
    );

    assert.ok(!defaultNames.includes("ConfiguredHocPanel"));
    assert.ok(!defaultNames.includes("UnconfiguredHocPanel"));
    assert.equal(configuredHocPanel?.kind, "wrapped");
    assert.deepEqual(
        configuredHocPanel?.props.map(prop => ({
            name: prop.name,
            optional: prop.optional,
        })),
        [{ name: "status", optional: false }]
    );
});

test("extracts React.FC, FC, generic, and forwardRef props", async () => {
    type PropsExtractionCase = {
        componentName: string;
        expectedProps: string[];
        defaults: Array<readonly [propName: string, defaultValue: string]>;
    };

    const cases = [
        {
            componentName: "FcPanel",
            expectedProps: ["label", "count"],
            defaults: [["count", "1"]],
        },
        {
            componentName: "AliasFcPanel",
            expectedProps: ["title"],
            defaults: [],
        },
        {
            componentName: "GenericPanel",
            expectedProps: ["title", "tone"],
            defaults: [],
        },
        {
            componentName: "GenericForwardRef",
            expectedProps: ["value", "disabled"],
            defaults: [["disabled", "false"]],
        },
    ] satisfies PropsExtractionCase[];

    for (const { componentName, expectedProps, defaults } of cases) {
        const component = await getComponent(fixturePath, componentName, false);

        if ("found" in component) {
            assert.fail(component.message);
        }

        assert.deepEqual(
            component.props.map(prop => prop.name),
            expectedProps
        );

        for (const [propName, defaultValue] of defaults) {
            const prop: PropInfo | undefined = component.props.find(candidate =>
                candidate.name === propName
            );

            assert.equal(prop?.defaultValue, defaultValue);
        }
    }
});

test("extracts props from nested component wrappers", async () => {
    const component = await getComponent(
        fixturePath,
        "NestedMemoForwardRef",
        false
    );

    if ("found" in component) {
        assert.fail(component.message);
    }

    assert.deepEqual(
        component.props.map(prop => ({
            name: prop.name,
            optional: prop.optional,
        })),
        [
            { name: "label", optional: false },
            { name: "disabled", optional: true },
        ]
    );
});

test("ignores uppercase utilities and unsupported HOC calls", async () => {
    const components = await listAllComponents();
    const names = components.map(component => component.name);

    assert.ok(!names.includes("PlainUppercaseUtility"));
    assert.ok(!names.includes("WrappedPlainUtility"));
});

test("finds lazy component JSX usages", async () => {
    const usage = await findComponentUsages(fixturePath, "LazyPanel");

    if ("found" in usage) {
        assert.fail(usage.message);
    }

    assert.equal(usage.usageCount, 1);
    assert.equal(usage.usedIn[0]?.text, "<LazyPanel />");
});

test("searches components by prop name", async () => {
    const result = await searchComponents(fixturePath, "variant");

    assert.deepEqual(
        result.items.map(component => component.name),
        ["Button"]
    );
});

test("searches components by JSDoc description", async () => {
    const result = await searchComponents(fixturePath, "application shell");

    assert.deepEqual(
        result.items.map(component => component.name),
        ["AppShell"]
    );
});

test("wide search scans JSX usages once per included source file", async (t) => {
    const expectedScanCount = countIncludedSourceFiles();
    const originalGetDescendants = SourceFile.prototype.getDescendants;
    const getDescendants = t.mock.method(
        SourceFile.prototype,
        "getDescendants",
        function getDescendants(this: SourceFile) {
            return originalGetDescendants.call(this);
        }
    );

    await searchComponents(fixturePath, "");

    assert.equal(getDescendants.mock.callCount(), expectedScanCount);
});

test("finds only JSX usages outside the declaration file", async () => {
    const usage = await findComponentUsages(fixturePath, "Button");

    if ("found" in usage) {
        assert.fail(usage.message);
    }

    assert.equal(usage.usageCount, 4);
    assert.equal(usage.usedIn.length, 4);
    assert.ok(usage.usedIn.every(location => location.kind === "jsx"));
    assert.ok(
        usage.usedIn.some(location =>
            location.filePath.endsWith("src/pages/Home.tsx")
        )
    );
    assert.ok(
        usage.usedIn.some(location =>
            location.filePath.endsWith("src/components/Dashboard.tsx")
        )
    );
    assert.ok(
        usage.usedIn.some(location =>
            normalizePath(location.filePath).endsWith("src/app/page.tsx")
        )
    );
    assert.deepEqual(
        usage.usedIn.map(location => location.text).sort(),
        [
            '<Btn title="Cancel" disabled={false} variant="secondary">',
            '<Button title="Open" variant="primary" />',
            '<Button title="Launch" variant="primary" />',
            '<Btn title="Save" variant="primary" />',
        ].sort()
    );
});

test("gets one component with usages by exact name", async () => {
    const component = await getComponent(fixturePath, "button");

    if ("found" in component) {
        assert.fail(component.message);
    }

    assert.equal(component.name, "Button");
    assert.equal(component.usageCount, 4);
});

test("returns a readable response for unknown component usage lookup", async () => {
    const usage = await findComponentUsages(fixturePath, "MissingComponent");

    assert.deepEqual(usage, {
        found: false,
        componentName: "MissingComponent",
        message:
            'Component "MissingComponent" was not found in the scanned project.',
    });
});

test("finds components without external JSX usages", async () => {
    const components = await findUnusedComponents(fixturePath);
    const names = components.map(component => component.name).sort();
    const unused = components.find(component => component.name === "Unused");
    const defaultPanel = components.find(component =>
        component.name === "DefaultPanel"
    );
    const layoutWatermark = components.find(component =>
        component.name === "LayoutWatermark"
    );

    assert.ok(names.includes("Unused"));
    assert.ok(names.includes("LocalOnly"));
    assert.ok(!names.includes("Button"));
    assert.equal(unused?.reason, "no_known_external_usages");
    assert.equal(unused?.confidence, "medium");
    assert.equal(unused?.risk, "medium");
    assert.deepEqual(unused?.usageKinds, []);
    assert.deepEqual(unused?.references, []);
    assert.equal(defaultPanel?.risk, "low");
    assert.equal(layoutWatermark?.risk, "high");
});

test("reports non-JSX references for unused component candidates", async () => {
    const components = await findUnusedComponents(fixturePath);
    const cases = [
        ["CreateElementOnly", "react_create_element"],
        ["PropOnly", "value_reference"],
        ["RouteConfigOnly", "route_config_reference"],
        ["RegistryOnly", "value_reference"],
        ["ObjectRegistryOnly", "value_reference"],
        ["DynamicOnly", "dynamic_reference"],
    ] as const;

    for (const [componentName, expectedKind] of cases) {
        const component = components.find(candidate =>
            candidate.name === componentName
        );

        assert.ok(component, componentName);
        assert.equal(
            component.reason,
            "no_external_jsx_usages_but_has_known_references"
        );
        assert.equal(component.confidence, "low");
        assert.equal(component.risk, "low");
        assert.deepEqual(component.usageKinds, [expectedKind]);
        assert.equal(component.references.length, 1);
        assert.equal(component.references[0]?.kind, expectedKind);
        assert.equal(component.references[0]?.text, componentName);
    }
});

test("reports lazy import references for unused component candidates", async () => {
    const components = await findUnusedComponents(fixturePath);
    const namedPanel = components.find(component =>
        component.name === "NamedPanel"
    );

    assert.ok(namedPanel);
    assert.equal(
        namedPanel.reason,
        "no_external_jsx_usages_but_has_known_references"
    );
    assert.equal(namedPanel.confidence, "low");
    assert.ok(namedPanel.usageKinds.includes("lazy_import"));
    assert.ok(
        namedPanel.references.some(reference =>
            reference.kind === "lazy_import"
        )
    );
});

test("keeps non-JSX references out of usage tools", async () => {
    const usage = await findComponentUsages(
        fixturePath,
        "CreateElementOnly"
    );
    const search = await searchComponents(
        fixturePath,
        "CreateElementOnly",
        {
            mode: "full",
        }
    );
    const component = search.items.find(candidate =>
        candidate.name === "CreateElementOnly"
    );

    if ("found" in usage) {
        assert.fail(usage.message);
    }

    assert.equal(usage.usageCount, 0);
    assert.deepEqual(usage.usedIn, []);
    assert.ok(component);
    assert.equal(component.usageCount, 0);
    assert.deepEqual(component.usedIn, []);
});

test("unused component lookup scans JSX usages once per included source file", async (t) => {
    const expectedScanCount = countIncludedSourceFiles();
    const originalGetDescendants = SourceFile.prototype.getDescendants;
    const getDescendants = t.mock.method(
        SourceFile.prototype,
        "getDescendants",
        function getDescendants(this: SourceFile) {
            return originalGetDescendants.call(this);
        }
    );

    await findUnusedComponents(fixturePath);

    assert.equal(getDescendants.mock.callCount(), expectedScanCount);
});

test("returns component dependencies", async () => {
    const result = await getComponentDependencies(fixturePath, "Dashboard");

    if ("found" in result) {
        assert.fail(result.message);
    }

    assert.equal(result.componentName, "Dashboard");
    assert.deepEqual(
        result.dependencies.map(dependency => dependency.name).sort(),
        ["Button", "Icon", "LazyPanel", "MemoBadge"]
    );
});

test("returns lazy import dependencies", async () => {
    const cases = [
        ["LazyPanel", "Panel", "src/components/Panel.tsx"],
        [
            "LazyDefaultPanel",
            "DefaultPanel",
            "src/components/DefaultPanel.tsx",
        ],
        ["LazyNamedPanel", "NamedPanel", "src/components/NamedPanel.tsx"],
    ] as const;

    for (const [componentName, dependencyName, dependencyPath] of cases) {
        const result = await getComponentDependencies(
            fixturePath,
            componentName
        );

        if ("found" in result) {
            assert.fail(result.message);
        }

        assert.equal(result.componentName, componentName);
        assert.deepEqual(
            result.dependencies.map(dependency => dependency.name),
            [dependencyName]
        );

        const dependency = result.dependencies[0];
        const usage = dependency?.usages[0];

        assert.ok(dependency);
        assert.ok(normalizePath(dependency.path).endsWith(dependencyPath));
        assert.equal(dependency.usages.length, 1);
        assert.equal(usage?.kind, "lazy_import");
        assert.match(usage?.text ?? "", /lazy/);
    }
});

test("resolves lazy import dependencies through tsconfig paths", async () => {
    const result = await getComponentDependencies(
        fixturePath,
        "LazyAliasPanel"
    );

    if ("found" in result) {
        assert.fail(result.message);
    }

    const dependency = result.dependencies[0];

    assert.equal(dependency?.name, "DefaultPanel");
    assert.ok(
        normalizePath(dependency?.path ?? "").endsWith(
            "src/components/DefaultPanel.tsx"
        )
    );
    assert.equal(dependency?.usages[0]?.kind, "lazy_import");
});

test("resolves dependencies by symbol for same-name components", async () => {
    const result = await getComponentDependencies(
        fixturePath,
        "SameNameDashboard"
    );

    if ("found" in result) {
        assert.fail(result.message);
    }

    const cardDependencies = result.dependencies.filter(
        dependency => dependency.name === "Card"
    );
    const featureACard = cardDependencies.find(dependency =>
        normalizePath(dependency.path).endsWith("src/feature-a/Card.tsx")
    );
    const featureBCard = cardDependencies.find(dependency =>
        normalizePath(dependency.path).endsWith("src/feature-b/Card.tsx")
    );

    assert.equal(cardDependencies.length, 2);
    assert.ok(featureACard);
    assert.ok(featureBCard);
    assert.deepEqual(
        featureACard.usages.map(usage => usage.text),
        ["<ProductCard />"]
    );
    assert.deepEqual(
        featureBCard.usages.map(usage => usage.text),
        ["<MarketingCard />", "<DirectFeatureBCard />"]
    );
    assert.ok(
        !result.dependencies.some(
            dependency => dependency.name === "MissingWidget"
        )
    );
});

test("resolves app dependencies through aliases and feature barrels", async () => {
    const result = await getComponentDependencies(
        fixturePath,
        "AppHomePage"
    );

    if ("found" in result) {
        assert.fail(result.message);
    }

    const cardDependencies = result.dependencies.filter(
        dependency => dependency.name === "Card"
    );

    assert.deepEqual(
        result.dependencies.map(dependency => dependency.name).sort(),
        ["Button", "Card", "Card", "ForwardInput"]
    );
    assert.equal(cardDependencies.length, 2);
    assert.ok(
        cardDependencies.some(dependency =>
            normalizePath(dependency.path).endsWith("src/feature-a/Card.tsx")
        )
    );
    assert.ok(
        cardDependencies.some(dependency =>
            normalizePath(dependency.path).endsWith("src/feature-b/Card.tsx")
        )
    );
});

test("returns component dependents", async () => {
    const result = await getComponentDependents(fixturePath, "MemoBadge");

    if ("found" in result) {
        assert.fail(result.message);
    }

    assert.deepEqual(
        sortedNames(result.dependents),
        ["AppShell", "Dashboard"]
    );
});

test("returns app dependents for shared components", async () => {
    const result = await getComponentDependents(fixturePath, "Button");

    if ("found" in result) {
        assert.fail(result.message);
    }

    const names = sortedNames(result.dependents);

    assert.ok(names.includes("AppHomePage"));
    assert.ok(names.includes("Dashboard"));
    assert.ok(names.includes("Home"));
});

test("returns lazy import dependents", async () => {
    const result = await getComponentDependents(fixturePath, "NamedPanel");

    if ("found" in result) {
        assert.fail(result.message);
    }

    assert.deepEqual(
        result.dependents.map(dependent => dependent.name),
        ["LazyNamedPanel"]
    );
    assert.equal(result.dependents[0]?.usages[0]?.kind, "lazy_import");
});

test("does not merge dependents for same-name components", async () => {
    const components = await listAllComponents();
    const selectedCard = components.find(component =>
        component.name === "Card"
    );

    assert.ok(selectedCard);

    const selectedPath = normalizePath(selectedCard.path);
    const selectedFeature = selectedPath.includes("/feature-a/")
        ? "feature-a"
        : "feature-b";
    const expectedConsumer =
        selectedFeature === "feature-a"
            ? "FeatureACardConsumer"
            : "FeatureBCardConsumer";
    const unexpectedConsumer =
        selectedFeature === "feature-a"
            ? "FeatureBCardConsumer"
            : "FeatureACardConsumer";
    const expectedDashboardUsages =
        selectedFeature === "feature-a"
            ? ["<ProductCard />"]
            : ["<MarketingCard />", "<DirectFeatureBCard />"];

    const result = await getComponentDependents(fixturePath, "Card");

    if ("found" in result) {
        assert.fail(result.message);
    }

    const dependentNames = result.dependents.map(
        dependent => dependent.name
    );
    const dashboard = result.dependents.find(
        dependent => dependent.name === "SameNameDashboard"
    );

    assert.ok(dependentNames.includes(expectedConsumer));
    assert.ok(!dependentNames.includes(unexpectedConsumer));
    assert.ok(dashboard);
    assert.deepEqual(
        dashboard.usages.map(usage => usage.text),
        expectedDashboardUsages
    );
});

test("supports include and exclude scan options", async () => {
    const result = await listComponents(fixturePath, {
        include: ["src/components/*.tsx"],
        exclude: ["**/Unused.tsx"],
        limit: 100,
        mode: "full",
    });
    const components = result.items;
    const names = components.map(component => component.name);

    assert.ok(names.includes("Button"));
    assert.ok(!names.includes("Unused"));
    assert.ok(!names.includes("Home"));
});

test("supports src include patterns across components, pages, and app", async () => {
    const result = await listComponents(fixturePath, {
        include: ["src/**/*.tsx"],
        exclude: ["**/*.stories.tsx", "**/*.test.tsx", "**/*.spec.tsx"],
        limit: 100,
        mode: "full",
    });
    const components = result.items;
    const names = sortedNames(components);

    assert.ok(names.includes("Button"));
    assert.ok(names.includes("Home"));
    assert.ok(names.includes("AppShell"));
    assert.ok(names.includes("AppHomePage"));
    assert.ok(!names.includes("FilterTargetStory"));
    assert.ok(!names.includes("FilterTargetTestHarness"));
});

test("excludes story and test usages when requested", async () => {
    const defaultUsage = await findComponentUsages(
        fixturePath,
        "FilterTarget"
    );
    const filteredUsage = await findComponentUsages(
        fixturePath,
        "FilterTarget",
        {
            exclude: ["**/*.stories.tsx", "**/*.test.tsx", "**/*.spec.tsx"],
        }
    );

    if ("found" in defaultUsage) {
        assert.fail(defaultUsage.message);
    }

    if ("found" in filteredUsage) {
        assert.fail(filteredUsage.message);
    }

    assert.equal(defaultUsage.usageCount, 2);
    assert.deepEqual(
        defaultUsage.usedIn.map(location => location.text).sort(),
        ['<FilterTarget mode="story" />', '<FilterTarget mode="test" />']
    );
    assert.equal(filteredUsage.usageCount, 0);
    assert.deepEqual(filteredUsage.usedIn, []);
});

test("applies default scan excludes", async () => {
    const components = await listAllComponents();
    const names = sortedNames(components);

    assert.ok(!names.includes("IgnoredStorybookComponent"));
});

test("matches default exclude paths", () => {
    const cases = [
        "node_modules/package/Button.tsx",
        "dist/IgnoredDistComponent.tsx",
        ".next/generated/IgnoredNextComponent.tsx",
        "storybook-static/IgnoredStorybookComponent.tsx",
    ];

    for (const relativePath of cases) {
        assert.equal(
            shouldIncludeFile(fixturePath, resolve(fixturePath, relativePath)),
            false
        );
    }
});

test("project cache includes files added during a session", async (t) => {
    const projectPath = await createFixtureCopy(
        t,
        "react-inspector-cache-added-"
    );
    const firstResult = await listComponents(projectPath, {
        limit: 200,
        mode: "full",
    });

    assert.ok(
        !firstResult.items.some(component =>
            component.name === "LifecycleAdded"
        )
    );

    await writeFile(
        join(projectPath, "src/components/LifecycleAdded.tsx"),
        [
            "export function LifecycleAdded() {",
            "  return <section />;",
            "}",
            "",
        ].join("\n"),
        "utf8"
    );

    const secondResult = await listComponents(projectPath, {
        limit: 200,
        mode: "full",
    });

    assert.ok(
        secondResult.items.some(component =>
            component.name === "LifecycleAdded"
        )
    );
});

test("project cache drops files deleted during a session", async (t) => {
    const projectPath = await createFixtureCopy(
        t,
        "react-inspector-cache-deleted-"
    );
    const firstResult = await listComponents(projectPath, {
        limit: 200,
        mode: "full",
    });

    assert.ok(firstResult.items.some(component => component.name === "Button"));

    await unlink(join(projectPath, "src/components/Button.tsx"));

    const secondResult = await listComponents(projectPath, {
        limit: 200,
        mode: "full",
    });

    assert.ok(
        !secondResult.items.some(component => component.name === "Button")
    );
});

test("project cache applies changed include and exclude scan filters", async (t) => {
    const projectPath = await createFixtureCopy(
        t,
        "react-inspector-cache-filters-"
    );
    const componentsOnly = await listComponents(projectPath, {
        include: ["src/components/*.tsx"],
        exclude: ["**/Unused.tsx"],
        limit: 200,
        mode: "full",
    });
    const pagesOnly = await listComponents(projectPath, {
        include: ["src/pages/*.tsx"],
        limit: 200,
        mode: "full",
    });
    const componentNames = componentsOnly.items.map(component =>
        component.name
    );
    const pageNames = pagesOnly.items.map(component => component.name);

    assert.ok(componentNames.includes("Button"));
    assert.ok(!componentNames.includes("Unused"));
    assert.ok(!componentNames.includes("Home"));
    assert.ok(pageNames.includes("Home"));
    assert.ok(!pageNames.includes("Button"));
});

test("project cache is bounded by the maximum entry count", async (t) => {
    const workDir = await mkdtemp(
        join(tmpdir(), "react-inspector-cache-limit-")
    );

    clearProjectCache();
    t.after(async () => {
        clearProjectCache();
        await rm(workDir, { recursive: true, force: true });
    });

    for (let index = 0; index < 6; index++) {
        const componentName = `CacheLimit${index}`;
        const projectPath = join(workDir, `project-${index}`);

        await writeMinimalReactProject(projectPath, componentName);
        await listComponents(projectPath, {
            limit: 10,
            mode: "full",
        });
    }

    const stats = getProjectCacheStats();

    assert.equal(stats.maxSize, 5);
    assert.equal(stats.size, 5);
});

test("refreshProjectCache returns a project refresh summary", async (t) => {
    const projectPath = await createFixtureCopy(
        t,
        "react-inspector-cache-refresh-"
    );

    await listComponents(projectPath, {
        limit: 200,
        mode: "full",
    });
    await writeFile(
        join(projectPath, "src/components/ExplicitRefresh.tsx"),
        [
            "export function ExplicitRefresh() {",
            "  return <section />;",
            "}",
            "",
        ].join("\n"),
        "utf8"
    );

    const summary = refreshProjectCache(projectPath);
    const result = await listComponents(projectPath, {
        limit: 200,
        mode: "full",
    });

    assert.equal(summary.projectPath, resolve(projectPath));
    assert.equal(summary.tsconfigPath, resolve(projectPath, "tsconfig.json"));
    assert.equal(summary.cacheSize, 1);
    assert.equal(summary.refreshed, true);
    assert.ok(summary.sourceFileCount > 0);
    assert.ok(
        result.items.some(component => component.name === "ExplicitRefresh")
    );
});
