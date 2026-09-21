#!yarn ts-node

import execa from 'execa';
import fs from 'fs';
import path from 'path';

type Workspace = {
  location: string;
  name: string;
  workspaceDependencies: string[];
};

const DEPENDENCY_GRAPH_START_MARKER = '<!-- start dependency graph -->';
const DEPENDENCY_GRAPH_END_MARKER = '<!-- end dependency graph -->';
const PACKAGE_LIST_START_MARKER = '<!-- start package list -->';
const PACKAGE_LIST_END_MARKER = '<!-- end package list -->';
const README_PATH = path.resolve(__dirname, '../README.md');
const YARNRC_PATH = path.resolve(__dirname, '../.yarnrc.yml');

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * The entrypoint to this script.
 *
 * Uses `yarn workspaces list` to:
 *
 * 1. Retrieve all of the workspace packages in this project and their relationships to each other.
 * 2. Produce a Markdown fragment that represents a Mermaid graph.
 * 3. Produce a Markdown fragment that represents a list of the workspace packages, and links to them.
 * 4. Update the README with the new content.
 */
async function main() {
  const workspaces = await retrieveWorkspaces();
  await updateReadme(
    getDependencyGraph(workspaces),
    getPackageList(workspaces),
  );
  console.log('README content updated.');
}

/**
 * Uses the `yarn` executable to gather the Yarn workspaces inside of this
 * project (the packages that are matched by the `workspaces` field inside of
 * `package.json`).
 *
 * @returns The list of workspaces.
 */
async function retrieveWorkspaces(): Promise<Workspace[]> {
  const { stdout } = await execa(process.execPath, [
    await getYarnCliPath(),
    'workspaces',
    'list',
    '--json',
    '--verbose',
  ]);

  return stdout
    .split('\n')
    .map((line) => JSON.parse(line))
    .slice(1);
}

async function getYarnCliPath(): Promise<string> {
  const npmExecPath = process.env.npm_execpath;

  if (npmExecPath && /yarn/i.test(path.basename(npmExecPath))) {
    return npmExecPath;
  }

  const yarnrc = await fs.promises.readFile(YARNRC_PATH, 'utf8');
  const match = yarnrc.match(/^yarnPath:\s+(.+)$/m);

  if (!match) {
    throw new Error('Unable to determine the Yarn CLI path from .yarnrc.yml');
  }

  return path.resolve(__dirname, '..', match[1]);
}

/**
 * Gets the Markdown fragment that represents a Mermaid graph of the
 * dependencies between the workspace packages in this project.
 *
 * @param workspaces - The Yarn workspaces inside of this project.
 * @returns The new dependency graph Markdown fragment.
 */
function getDependencyGraph(workspaces: Workspace[]): string {
  const nodeLines = buildMermaidNodeLines(workspaces);
  const connectionLines = buildMermaidConnectionLines(workspaces);
  return assembleMermaidMarkdownFragment(nodeLines, connectionLines);
}

/**
 * Builds a piece of the Mermaid graph by defining a node for each workspace
 * package within this project.
 *
 * @param workspaces - The Yarn workspaces inside of this project.
 * @returns A set of lines that will go into the final Mermaid graph.
 */
function buildMermaidNodeLines(workspaces: Workspace[]): string[] {
  return workspaces.map((workspace) => {
    const fullPackageName = workspace.name;
    const shortPackageName = getShortWorkspaceName(fullPackageName);
    return `${shortPackageName}(["${fullPackageName}"]);`;
  });
}

/**
 * Builds a piece of the Mermaid graph by defining connections between nodes
 * that correspond to dependencies between workspace packages within this
 * project.
 *
 * @param workspaces - The Yarn workspaces inside of this project.
 * @returns A set of lines that will go into the final Mermaid graph.
 */
function buildMermaidConnectionLines(workspaces: Workspace[]): string[] {
  const connections: string[] = [];
  const workspaceNamesByLocation = new Map(
    workspaces.map((workspace) => [workspace.location, workspace.name]),
  );

  workspaces.forEach((workspace) => {
    const fullPackageName = workspace.name;
    const shortPackageName = getShortWorkspaceName(fullPackageName);

    workspace.workspaceDependencies.forEach((dependency) => {
      const fullDependencyName =
        workspaceNamesByLocation.get(dependency) ?? dependency;
      const shortDependencyName = getShortWorkspaceName(fullDependencyName);

      connections.push(`${shortPackageName} --> ${shortDependencyName};`);
    });
  });
  return connections;
}

function getShortWorkspaceName(fullPackageName: string): string {
  return fullPackageName.replace(/^@rabby-wallet\//, '').replace(/-/g, '_');
}

/**
 * Creates the Mermaid graph from the given node lines and connection lines,
 * wrapping it in a triple-backtick directive so that it can be embedded within
 * a Markdown document.
 *
 * @param nodeLines - The set of nodes in the graph as lines.
 * @param connectionLines - The set of connections in the graph as lines.
 * @returns The graph in string format.
 */
function assembleMermaidMarkdownFragment(
  nodeLines: string[],
  connectionLines: string[],
): string {
  return [
    '```mermaid',
    "%%{ init: { 'flowchart': { 'curve': 'bumpX' } } }%%",
    'graph LR;',
    'linkStyle default opacity:0.5',
    ...nodeLines.map((line) => `  ${line}`),
    ...connectionLines.map((line) => `  ${line}`),
    '```',
  ].join('\n');
}

/**
 * Gets the Markdown fragment that represents a list of the workspace packages
 * in this project.
 *
 * @param workspaces - The Yarn workspaces inside of this project.
 * @returns The new package list Markdown fragment.
 */
function getPackageList(workspaces: Workspace[]): string {
  return workspaces
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((workspace) => `- [\`${workspace.name}\`](${workspace.location})`)
    .join('\n');
}

/**
 * Updates the dependency graph section in the README with the given Markdown
 * fragment.
 *
 * @param newGraph - The new dependency graph Markdown fragment.
 * @param newPackageList - The new package list Markdown fragment.
 */
async function updateReadme(newGraph: string, newPackageList: string) {
  const readmeContent = await fs.promises.readFile(README_PATH, 'utf8');

  // Dependency graph
  let newReadmeContent = readmeContent.replace(
    new RegExp(
      `(${DEPENDENCY_GRAPH_START_MARKER})[\\s\\S]+?(${DEPENDENCY_GRAPH_END_MARKER})`,
      '',
    ),
    (_match, startMarker, endMarker) =>
      [startMarker, '', newGraph, '', endMarker].join('\n'),
  );

  // Package list
  newReadmeContent = newReadmeContent.replace(
    new RegExp(
      `(${PACKAGE_LIST_START_MARKER})[\\s\\S]+?(${PACKAGE_LIST_END_MARKER})`,
      '',
    ),
    (_match, startMarker, endMarker) =>
      [startMarker, '', newPackageList, '', endMarker].join('\n'),
  );

  await fs.promises.writeFile(README_PATH, newReadmeContent);
}
