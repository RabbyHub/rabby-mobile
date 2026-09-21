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
