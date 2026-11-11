%===============================================================================
% Rabby Mobile workspace constraints
%===============================================================================
%
% This repository contains multiple kinds of workspaces: mobile and web apps,
% published JavaScript packages, source-linked React Native forks, and internal
% tooling. Their entrypoints, scripts, dependency majors, repository metadata,
% and consumer-facing Node ranges are intentionally different. Constraints
% therefore enforce only invariants that are valid across those boundaries.

% Every workspace must have an explicit package name.
\+ gen_enforced_field(WorkspaceCwd, 'name', null).

% Repository tooling and the mobile app use Node 22. Published package engine
% ranges remain independent because they describe consumer compatibility.
gen_enforced_field('.', 'engines.node', '>=22').
gen_enforced_field('apps/mobile', 'engines.node', '>=22').

% Runtime and development references to local workspaces use Yarn's workspace
% protocol. Peer ranges remain normal semver because they describe consumers.
gen_enforced_dependency(WorkspaceCwd, DependencyIdent, 'workspace:^', DependencyType) :-
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, DependencyType),
  workspace_ident(OtherWorkspaceCwd, DependencyIdent),
  WorkspaceCwd \= OtherWorkspaceCwd,
  DependencyType \= 'peerDependencies',
  DependencyRange \= 'workspace:^'.

% A dependency belongs to one runtime bucket within a workspace. Matching
% duplicates under dependencies and devDependencies add no install capability.
gen_enforced_dependency(WorkspaceCwd, DependencyIdent, null, 'devDependencies') :-
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, 'dependencies'),
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, 'devDependencies').

% Direct dependency ranges must be exact. Peel the two range prefixes that
% `yarn add` historically wrote, so `yarn constraints --fix` can replace them
% with the bare version. scripts/check-pinned-dependencies.js additionally
% validates aliases, patches, optional dependencies, and non-workspace input
% manifests such as tpl/sample-package. peerDependencies keep consumer-facing
% semver ranges by design.
range_prefix(Range, ExactVersion) :-
  atom_concat('^', ExactVersion, Range).
range_prefix(Range, ExactVersion) :-
  atom_concat('~', ExactVersion, Range).

gen_enforced_dependency(WorkspaceCwd, DependencyIdent, ExactVersion, DependencyType) :-
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, DependencyType),
  DependencyType \= 'peerDependencies',
  range_prefix(DependencyRange, ExactVersion).

% Runtime dependencies share one version within a theme. Themes are assigned
% by workspace family, not by an allow-list of dependencies: react-native and
% shared packages are bundled into the mobile app, web apps are evaluated
% separately, and repository tooling has its own scope. A new packages/*
% workspace joins the mobile theme automatically; a new apps/* workspace joins
% tooling unless it is explicitly classified as mobile or web.
workspace_theme('.', 'tooling').
workspace_theme('apps/dev-console-cra', 'web').
workspace_theme('apps/mobile-local-pages', 'web').
workspace_theme('packages/rozenite-resource-flow-plugin', 'web').
workspace_theme('apps/mobile', 'mobile').
workspace_theme(WorkspaceCwd, 'mobile') :-
  atom_concat('packages/', _, WorkspaceCwd),
  WorkspaceCwd \= 'packages/rozenite-resource-flow-plugin'.
workspace_theme(WorkspaceCwd, 'tooling') :-
  atom_concat('apps/', _, WorkspaceCwd),
  WorkspaceCwd \= 'apps/dev-console-cra',
  WorkspaceCwd \= 'apps/mobile-local-pages',
  WorkspaceCwd \= 'apps/mobile'.

theme_dependency_versions(Theme, DependencyIdent, Pairs) :-
  findall(WorkspaceCwd-DependencyRange, (
    workspace(WorkspaceCwd),
    workspace_theme(WorkspaceCwd, Theme),
    workspace_has_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, 'dependencies')
  ), Pairs).

% Pick the lexicographically first workspace in the theme as canonical. The
% mobile app therefore wins for mobile dependencies, and dev-console-cra wins
% for web dependencies that it uses.
theme_dependency_first_range(Theme, DependencyIdent, DependencyRange) :-
  theme_dependency_versions(Theme, DependencyIdent, Pairs),
  sort(Pairs, [_-DependencyRange|_]).

gen_enforced_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, 'dependencies') :-
  workspace_theme(WorkspaceCwd, Theme),
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, _, 'dependencies'),
  theme_dependency_first_range(Theme, DependencyIdent, DependencyRange).
