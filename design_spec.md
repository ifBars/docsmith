# DocSmith System Upgrade Specification: Multi-File Framework Support

## 1. Objective
Upgrade DocSmith from a single-file generator (READMEs) to a comprehensive documentation suite generator capable of scaffolding and writing full documentation sites using popular frameworks (VitePress, Docusaurus, Fumadocs, DocFX).

## 2. Core Concepts

### A. The `DocFramework`
We introduce the concept of a "Framework Strategy".
- **Single File:** (Legacy) README.md, CONTRIBUTING.md.
- **VitePress:** `docs/index.md`, `docs/guide/...`
- **Docusaurus:** `docs/intro.md`, `docusaurus.config.js`
- **Fumadocs:** `content/docs/...`
- **DocFX:** `index.md`, `docfx.json`

### B. The `DocProject` Structure
Instead of a single list of sections, the application state now manages a list of **Files**.
Each **File** contains its own list of **Sections**.

**Hierarchy:**
`RepoContext` -> `DocProject` (Framework choice) -> `DocFile[]` -> `Section[]` -> `Content`.

## 3. UI/UX Changes

### Phase 1: Planning (Updated)
**Previous:** Select DocType -> Generate Outline (Sections).
**New:** Select Framework -> Generate File Structure (List of Files).

The user sees a "File Explorer" view of the proposed documentation site. They can add/remove files before moving to the drafting phase.

### Phase 2: Editor (Updated)
**Previous:** Sidebar showed Sections of the current file.
**New:** Two-level Sidebar.
1. **Files Tab:** Navigation between different `.md` files.
2. **Outline Tab:** Navigation between sections within the *active* file.

## 4. AI Workflows

### Workflow A: Structure Generation
**Input:** Repo Analysis + Selected Framework (e.g., VitePress).
**Output:** A JSON list of file paths and purposes.
*Example:*
```json
[
  { "path": "docs/index.md", "purpose": "Landing page" },
  { "path": "docs/guide/getting-started.md", "purpose": "Installation" }
]
```

### Workflow B: File Outline Generation (Lazy Loading)
We do not generate section outlines for *every* file immediately (too expensive/slow).
When the user clicks a specific file in the Editor:
1. Check if sections exist.
2. If not, generate sections based on `RepoContext` + `File Purpose`.

## 5. Technical Implementation Plan

1.  **Types:** Update `types.ts` to include `DocFramework` and `DocFile`.
2.  **Service:** Add `planFileStructure` to `geminiService.ts`.
3.  **Planner:** Rewrite `DocPlanner.tsx` to select Frameworks and review the File List.
4.  **Editor:** Update `DocEditor.tsx` to handle a collection of files and switch contexts.
