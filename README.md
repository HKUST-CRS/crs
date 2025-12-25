# CRS

CRS stands for "CSE Request System".

### Repository Structure

Utilizing [Bun](https://bun.sh/) as the package manager and JS runtime, this repository is a monorepo[^1] [^2] that contains 3 packages of CRS, which essentially act as the Model, View, and Controller as in (some variation of) the [MVC architecture](https://developer.mozilla.org/en-US/docs/Glossary/MVC).

- `packages/service` defines the Model.
- `packages/site` defines the View.
- `packages/server` defines the Controller.

[^1]: [Configuring a monorepo using workspaces with Bun](https://bun.com/guides/install/workspaces)
[^2]: [Bun - Workspaces](https://bun.com/docs/install/workspaces)

To install dependencies for all packages (Service, View, and Controller):

```bash
bun install
```

### Tech Stack

The current plan is to preserve type-safety throughout the application by leveraging TypeScript and its powerful type system. In particular,

- The Model utilizes the typesystem in TypeScript and [Zod](https://github.com/colinhacks/zod) for preserving type safety, building JSON schema, and validating JSON information.
- The Controller, based on the Model, uses [tRPC](https://trpc.io/) for creating type-safe APIs, and [MongoDB](https://www.mongodb.com/) for (type-safe and efficient) persistent data storage.
- The View, based on the Controller, mainly makes use of [React](https://reactjs.org/), [Next.js](https://nextjs.org/), [shadcn/ui](https://ui.shadcn.com/), and [Tailwind CSS](https://tailwindcss.com/) for building the beautiful server-side rendering site.

## License

All source code in this repository is licensed under the MIT License. Certain university-specific assets and materials are excluded from this license and are not open source. Those assets remain the exclusive property of the *Hong Kong University of Science and Technology* *(HKUST)* and/or the *Department of Computer Science and Engineering, HKUST* *(CSE)*, which reserve all rights not expressly granted herein.