# Copilot Instructions

## High Level Details
- **Project**: CRS (CSE Request System), a course registration and request management system.
- **Architecture**: Monorepo using [Bun](https://bun.sh/) workspaces. The project follows a variation of MVC:
  - **Model**: `packages/service` - Core logic. MongoDB, Zod.
  - **View**: `packages/site` - Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui.
  - **Controller**: `packages/server` - tRPC.
- **Language**: TypeScript (Strict mode).
- **Package Manager**: Bun.
- **Linter/Formatter**: [Biome](https://biomejs.dev/).

## Build Instructions

### Prerequisite

1.  **Install dependencies**:
    ```bash
    bun install
    ```
2.  **Environment Setup**:
    - `packages/server/.env` (Copy from `.env.example`)
    - `packages/site/.env.local` (Copy from `.env.example`)

### Tasks

1.  **Lint and Format**:
    Always run this before committing. It uses Biome to format and lint the entire repo.
    ```bash
    bun run lint:fix
    ```

2.  **Typecheck**:
    Always run this before committing. It uses TypeScript to typecheck the entire repo.
    ```bash
    bun run typecheck
    ```

3.  **Test (Service Package)**:
    Always run this before committing if there are changes to the service package. It runs unit and integration tests for the core logic.
    ```bash
    cd packages/service && bun test
    ```

4.  **Development Server**:
    Starts both the server and site concurrently.
    ```bash
    bun run dev
    ```

## Project Layout

- **`packages/service`** (The Model):
  - `models/`: contains the data models (as Zod schemas).
  - `repos/` contains the repository layer for data access.
  - `services/`: contains the service layer for business logic.
  - `db/` contains database connection and setup logic.
  - `tests/` contains the tests for the service package.

- **`packages/site`** (The View):
  - `app/`: Next.js App Router structure.
  - `components/` contains components.
  - `components/ui/` contains generic `shadcn/ui` components.
  - `lib/` contains utilities.

- **`packages/server`** (The Controller):
  - `routers/`: is the tRPC routers defining API endpoints.

## General Instructions

- Do not include comments in the code unless they are necessary for clarity.
- Prefer concise and efficient code.
- Prefer simplicity over performance unless it is critical.
- Think of the best practices; design and implement accordingly.
- Use functional programming principles if possible.
- Follow the existing code style and conventions in the project.
- Check for typos and grammar errors in code and documentation; check for consistency in naming and formatting; check for clear and concise expressions.

### Service Package

- Any changes should come with documentation.
- Any changes should come with tests.

### Site Package

- Keep the UI structure clear and maintainable.
