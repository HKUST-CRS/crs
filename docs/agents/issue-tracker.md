# Issue tracker: GitHub

Issues and specs live in `HKUST-CRS/crs` on GitHub. Use the `gh` CLI with
`--repo HKUST-CRS/crs` explicitly; this checkout also has contributor forks.

## Conventions

- Create: `gh issue create --repo HKUST-CRS/crs --title "..." --body-file <file>`.
- Read: `gh issue view <number> --repo HKUST-CRS/crs --json number,title,body,labels,comments`.
- List: `gh issue list --repo HKUST-CRS/crs --state open --json number,title,body,labels,comments`; add label filters as needed.
- Comment: `gh issue comment <number> --repo HKUST-CRS/crs --body-file <file>`.
- Label: `gh issue edit <number> --repo HKUST-CRS/crs --add-label "..."` or `--remove-label "..."`.
- Close: `gh issue close <number> --repo HKUST-CRS/crs --comment "..."`.
- Sub-issue: create with `gh issue create --repo HKUST-CRS/crs --parent <parent> ...`, or link with `gh issue edit <parent> --repo HKUST-CRS/crs --add-sub-issue <child>`.

For multiline bodies, write the exact text to a temporary file and pass
`--body-file`. Follow the existing contribution conventions in `CONTRIBUTING.md`.

When a skill says to publish to the issue tracker, create a GitHub issue. When it
says to fetch a ticket, read the corresponding issue and its comments.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub issues and PRs share numbers. For an ambiguous reference, try
`gh pr view <number> --repo HKUST-CRS/crs`, then fall back to `gh issue view`.

## Wayfinding operations

- Map: an issue labelled `wayfinder:map`, containing Notes, Decisions-so-far, and Fog.
- Child ticket: a sub-issue of the map, labelled `wayfinder:<type>` where type is `research`, `prototype`, `grilling`, or `task`. If sub-issues are unavailable, add a task-list link in the map and `Part of #<map>` in the child.
- Blocking: use native issue dependencies. Get the blocker's database ID with `gh api repos/HKUST-CRS/crs/issues/<number> --jq .id`, then add it with `gh api --method POST repos/HKUST-CRS/crs/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-id>`. If unavailable, use a `Blocked by: #<number>` line in the child.
- Frontier: inspect the map's open children in map order. The first unassigned child with no open blocker is eligible; native `issue_dependencies_summary.blocked_by` counts open blockers.
- Claim: `gh issue edit <number> --repo HKUST-CRS/crs --add-assignee @me`.
- Resolve: comment with the answer, close the child, and append a short answer and link to the map's Decisions-so-far.

Create any missing `wayfinder:*` labels when first using that workflow.
