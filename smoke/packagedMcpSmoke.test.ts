import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const execFileAsync = promisify(execFile);
const commandTimeoutMs = 120_000;
const mcpTimeoutMs = 30_000;
const maxCommandBuffer = 10 * 1024 * 1024;
const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");
const npmExecPath = process.env.npm_execpath;
const npmCommand = npmExecPath
    ? process.execPath
    : process.platform === "win32"
      ? "npm.cmd"
      : "npm";
const binName =
    process.platform === "win32"
        ? "react-inspector-mcp.cmd"
        : "react-inspector-mcp";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function propertyToString(
    value: unknown,
    propertyName: string
): string {
    if (!isRecord(value)) {
        return "";
    }

    const property = value[propertyName];

    if (typeof property === "string") {
        return property;
    }

    if (Buffer.isBuffer(property)) {
        return property.toString("utf8");
    }

    return "";
}

function formatUnknownError(error: unknown): string {
    if (error instanceof Error) {
        return error.stack ?? error.message;
    }

    return String(error);
}

function formatCommandError(
    command: string,
    args: string[],
    error: unknown
): string {
    const stdout = propertyToString(error, "stdout").trim();
    const stderr = propertyToString(error, "stderr").trim();
    const details = [
        `Command failed: ${command} ${args.join(" ")}`,
        formatUnknownError(error),
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : "",
    ].filter(Boolean);

    return details.join("\n\n");
}

async function runCommand(
    command: string,
    args: string[],
    cwd: string
): Promise<void> {
    try {
        await execFileAsync(command, args, {
            cwd,
            encoding: "utf8",
            maxBuffer: maxCommandBuffer,
            timeout: commandTimeoutMs,
        });
    } catch (error) {
        throw new Error(formatCommandError(command, args, error), {
            cause: error,
        });
    }
}

async function runNpm(args: string[], cwd: string): Promise<void> {
    await runCommand(
        npmCommand,
        npmExecPath ? [npmExecPath, ...args] : args,
        cwd
    );
}

async function findPackedTarball(packDir: string): Promise<string> {
    const files = await readdir(packDir);
    const tarballs = files.filter(file => file.endsWith(".tgz"));

    assert.equal(
        tarballs.length,
        1,
        `Expected one packed tarball, found: ${tarballs.join(", ")}`
    );

    const tarball = tarballs[0];
    assert.ok(tarball, "Packed tarball was not found");

    return join(packDir, tarball);
}

async function writeConsumerProject(consumerDir: string): Promise<void> {
    await writeFile(
        join(consumerDir, "package.json"),
        `${JSON.stringify(
            {
                name: "react-inspector-mcp-smoke-consumer",
                private: true,
                type: "module",
            },
            null,
            2
        )}\n`,
        "utf8"
    );
}

async function writeReactFixture(projectDir: string): Promise<void> {
    const srcDir = join(projectDir, "src");

    await mkdir(srcDir, { recursive: true });
    await writeFile(
        join(projectDir, "tsconfig.json"),
        `${JSON.stringify(
            {
                compilerOptions: {
                    jsx: "preserve",
                    target: "ES2023",
                    module: "ESNext",
                    moduleResolution: "Bundler",
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
            "    button: Record<string, unknown>;",
            "    main: Record<string, unknown>;",
            "  }",
            "}",
            "",
        ].join("\n"),
        "utf8"
    );
    await writeFile(
        join(srcDir, "Button.tsx"),
        [
            "export interface ButtonProps {",
            "  title: string;",
            "  disabled?: boolean;",
            "}",
            "",
            "export function Button(props: ButtonProps) {",
            "  return <button disabled={props.disabled}>{props.title}</button>;",
            "}",
            "",
        ].join("\n"),
        "utf8"
    );
    await writeFile(
        join(srcDir, "App.tsx"),
        [
            'import { Button } from "./Button";',
            "",
            "export function App() {",
            '  return <main><Button title="Save" /></main>;',
            "}",
            "",
        ].join("\n"),
        "utf8"
    );
}

function getToolText(result: unknown): string {
    if (!isRecord(result) || !Array.isArray(result.content)) {
        assert.fail("Tool result did not include MCP text content");
    }

    const [firstContent] = result.content;

    if (
        !isRecord(firstContent) ||
        firstContent.type !== "text" ||
        typeof firstContent.text !== "string"
    ) {
        assert.fail("Tool result first content item was not text");
    }

    return firstContent.text;
}

function assertRecordArray(
    value: unknown
): asserts value is Record<string, unknown>[] {
    if (!Array.isArray(value) || !value.every(isRecord)) {
        assert.fail("Expected list_components to return an array of objects");
    }
}

test(
    "packed package starts over MCP stdio and lists components",
    { timeout: 180_000 },
    async () => {
        const workDir = await mkdtemp(
            join(tmpdir(), "react-inspector-mcp-smoke-")
        );
        const packDir = join(workDir, "pack");
        const consumerDir = join(workDir, "consumer");
        const targetProjectDir = join(workDir, "target-react-project");
        let client: Client | undefined;
        let serverStderr = "";

        try {
            await mkdir(packDir, { recursive: true });
            await mkdir(consumerDir, { recursive: true });
            await writeConsumerProject(consumerDir);
            await writeReactFixture(targetProjectDir);

            await runNpm(
                ["pack", "--pack-destination", packDir],
                repoRoot
            );

            const tarballPath = await findPackedTarball(packDir);

            await runNpm(
                [
                    "install",
                    "--ignore-scripts",
                    "--no-audit",
                    "--fund=false",
                    "--package-lock=false",
                    tarballPath,
                ],
                consumerDir
            );

            const transport = new StdioClientTransport({
                command: join(consumerDir, "node_modules", ".bin", binName),
                cwd: consumerDir,
                stderr: "pipe",
            });
            transport.stderr?.on("data", chunk => {
                serverStderr += chunk.toString();
            });

            client = new Client(
                {
                    name: "react-inspector-mcp-smoke",
                    version: "1.0.0",
                },
                {
                    capabilities: {},
                }
            );

            await client.connect(transport, { timeout: mcpTimeoutMs });

            assert.equal(
                client.getServerVersion()?.name,
                "react-inspector-mcp"
            );
            assert.ok(client.getServerCapabilities()?.tools);

            const tools = await client.listTools(undefined, {
                timeout: mcpTimeoutMs,
            });
            const toolNames = tools.tools.map(tool => tool.name);

            assert.ok(toolNames.includes("list_components"));

            const listComponentsResult = await client.callTool(
                {
                    name: "list_components",
                    arguments: {
                        projectPath: targetProjectDir,
                    },
                },
                undefined,
                { timeout: mcpTimeoutMs }
            );
            const payload: unknown = JSON.parse(
                getToolText(listComponentsResult)
            );

            assertRecordArray(payload);

            const componentNames = payload.map(component => component.name);
            const button = payload.find(component =>
                component.name === "Button"
            );

            assert.ok(componentNames.includes("App"));
            assert.ok(button, "Button component was not returned");
            assert.equal(button.exported, true);

            const props = button.props;
            assert.ok(Array.isArray(props), "Button props were not an array");
            assert.ok(
                props.some(prop =>
                    isRecord(prop) &&
                    prop.name === "title" &&
                    prop.optional === false
                ),
                "Button title prop was not detected"
            );
        } catch (error) {
            assert.fail(
                [
                    formatUnknownError(error),
                    serverStderr.trim()
                        ? `Server stderr:\n${serverStderr.trim()}`
                        : "",
                ]
                    .filter(Boolean)
                    .join("\n\n")
            );
        } finally {
            try {
                await client?.close();
            } catch {
                // Ignore shutdown errors after the smoke assertion has finished.
            }

            await rm(workDir, { recursive: true, force: true });
        }
    }
);
