# CRS

CRS stands for "CSE Request System".

It's live at https://crs.cse.ust.hk/.

### Repository Structure

Utilizing [Bun](https://bun.sh/) as the package manager and JS runtime, this repository is a monorepo[^1] [^2] that contains 3 packages of CRS, which essentially act as the Model, View, and Controller as in (some variation of) the [MVC architecture](https://developer.mozilla.org/en-US/docs/Glossary/MVC).

- `packages/service` defines the Model.
- `packages/site` defines the View.
- `packages/server` defines the Controller.

[^1]: [Configuring a monorepo using workspaces with Bun](https://bun.com/guides/install/workspaces)
[^2]: [Bun - Workspaces](https://bun.com/docs/install/workspaces)

To install dependencies for all three packages:

```bash
bun install
```

Then, configure the environment variables as specified in the `.env.example` files in the `site` and `server` packages. Copy the `.env.example` files to `.env` file (for `server` package) and `.env.local` file (for `site` package) respectively, and fill in the missing values.

Start the local MongoDB replica set and seed a development user:

```bash
docker compose up
bun run --filter=server seed <email> [name] [--sudo] [--clean]
```

Set the same optional `CRS_DEV_USER` email in both environment files to bypass Microsoft authentication locally, and pass that email to the seed command. Add `--sudo` when the development user needs sudo privileges, or `--clean` to reset the database first. Then begin development with:

```bash
bun dev
```

### Examination appeals

Instructors first enroll reviewers with the `grader` role using the existing
Enrollment Manager, then assign those graders to questions in course exam
settings and enable Examination Appeal. Use section `*` for a grader who handles
all sections. Grader enrollment alone grants no request access: the request must
also target the grader's assigned exam question in an enrolled section. Removing
the role or question assignment revokes delegated access. Existing class
instructor and observer access still applies; observer enrollment alone grants
read-only access. A requester cannot decide their own examination appeal.

Each question is stored as one immutable request with `{ examCode, question }`
metadata. Its reason and supporting documents belong to the opening thread
comment. Later comments, decisions, cancellation, and appeals use
the existing request thread and status lifecycle.

Appeals are ordinary requests with different metadata. `request.getAllAs` accepts
the `grader` role and returns only targeted cases; student and instructor inboxes
use the same API. Both `request.create` and the generic `request.createMany`
accept examination appeals. `createMany` takes `{ submissionId, requests }`,
where the UUID identifies 1–50 `{ request, comment }` entries. The server checks
student eligibility, section and exam/question membership, course enablement,
and the assigned grader's enrollment. Repeated exam/question targets in the
same class are rejected.

All batched requests and a generic submission receipt commit in one MongoDB
transaction. The receipt stores the payload fingerprint and resulting IDs; it
contains no separate appeal data. Retrying the same normalized payload with the
same UUID returns the original IDs, even if enrollment or course configuration
subsequently changes. Reusing a UUID with a different payload returns a conflict. The form
retains the UUID for an unchanged retry after an unconfirmed response; leaving
or reloading the form starts a new submission.

Notifications run only for a newly committed batch. Email failure does not
invalidate the saved submission; durable email recovery remains separate work.
GridFS uploads happen before the transaction because GridFS does not support
multi-document transactions. Failed or uncertain transactions may leave unused
uploads for attachment reconciliation (#136); committed proofs are retained.

### Tech Stack

The current plan is to preserve type-safety throughout the application by leveraging TypeScript and its powerful type system. In particular,

- The Model utilizes the type system in TypeScript and [Zod](https://github.com/colinhacks/zod) for preserving type safety, building JSON schema, and validating JSON information.
- The View mainly makes use of [React](https://reactjs.org/), [Next.js](https://nextjs.org/), [shadcn/ui](https://ui.shadcn.com/), and [Tailwind CSS](https://tailwindcss.com/) for building the beautiful server-side rendering site.
- The Controller uses [tRPC](https://trpc.io/) for creating type-safe APIs, and [MongoDB](https://www.mongodb.com/) for (type-safe and efficient) persistent data storage.

## License

All source code in this repository is licensed under the MIT License. Certain university-specific assets and materials are excluded from this license and are not open source. Those assets remain the exclusive property of the *Hong Kong University of Science and Technology* *(HKUST)* and/or the *Department of Computer Science and Engineering, HKUST* *(CSE)*, which reserve all rights not expressly granted herein.
