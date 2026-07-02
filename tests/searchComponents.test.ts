import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
    findComponentUsages,
    findUnusedComponents,
    getComponent,
    getComponentDependencies,
    getComponentDependents,
    listComponents,
    searchComponents,
} from "../src/tools/searchComponents.js";
import { shouldIncludeFile } from "../src/services/pathMatcher.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(testDir, "fixtures/react-project");

function normalizePath(value: string): string {
    return value.replace(/\\/g, "/");
}

function sortedNames(values: Array<{ name: string }>): string[] {
    return values.map(value => value.name).sort();
}

test("lists detected React components with props and metadata", async () => {
    const components = await listComponents(fixturePath);
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
    const components = await listComponents(fixturePath);
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
    const components = await listComponents(fixturePath);
    const names = components.map(component => component.name);

    assert.ok(names.includes("MemoBadge"));
    assert.ok(names.includes("ForwardInput"));
    assert.ok(names.includes("NestedMemoForwardRef"));
    assert.ok(names.includes("ReactNestedMemoForwardRef"));
    assert.ok(names.includes("MixedMemoForwardRef"));
    assert.ok(names.includes("MixedReactMemoForwardRef"));
    assert.ok(names.includes("LazyPanel"));
    assert.ok(names.includes("LazyDefaultPanel"));
    assert.ok(names.includes("LazyNamedPanel"));
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
    const components = await listComponents(fixturePath);
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
    const components = await searchComponents(fixturePath, "variant");

    assert.deepEqual(
        components.map(component => component.name),
        ["Button"]
    );
});

test("searches components by JSDoc description", async () => {
    const components = await searchComponents(fixturePath, "application shell");

    assert.deepEqual(
        components.map(component => component.name),
        ["AppShell"]
    );
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
    assert.equal(unused?.reason, "no_external_jsx_usages");
    assert.equal(unused?.risk, "medium");
    assert.equal(defaultPanel?.risk, "low");
    assert.equal(layoutWatermark?.risk, "high");
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
    const components = await listComponents(fixturePath);
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
    const components = await listComponents(fixturePath, {
        include: ["src/components/*.tsx"],
        exclude: ["**/Unused.tsx"],
    });
    const names = components.map(component => component.name);

    assert.ok(names.includes("Button"));
    assert.ok(!names.includes("Unused"));
    assert.ok(!names.includes("Home"));
});

test("supports src include patterns across components, pages, and app", async () => {
    const components = await listComponents(fixturePath, {
        include: ["src/**/*.tsx"],
        exclude: ["**/*.stories.tsx", "**/*.test.tsx", "**/*.spec.tsx"],
    });
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
    const components = await listComponents(fixturePath);
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
