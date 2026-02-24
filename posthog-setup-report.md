<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the CSE Request System (`packages/site`), a Next.js 16 App Router application for university course administration. The integration covers client-side event tracking across all key student and instructor workflows, user identification via Microsoft Entra ID sessions, automatic error tracking, and a reverse proxy for reliable event delivery.

## What was changed

### New files created

| File | Purpose |
|------|---------|
| `packages/site/instrumentation-client.ts` | Client-side PostHog initialization using Next.js 15.3+ `instrumentation-client` convention. Enables session replay, error tracking, and auto-pageview capture. |
| `packages/site/lib/posthog-server.ts` | Server-side PostHog Node.js client factory (`getPostHogClient()`), ready for use in API routes and Server Actions. |
| `packages/site/.env.local` | Environment variables `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` (covered by `.gitignore`). |

### Modified files

| File | Changes |
|------|---------|
| `packages/site/next.config.ts` | Added `/ingest` reverse proxy rewrites to PostHog US endpoints and `skipTrailingSlashRedirect: true`. |
| `packages/site/app/login/page.tsx` | Added `user_login_initiated` capture and `posthog.identify()` for already-authenticated sessions. |
| `packages/site/app/students-view.tsx` | Added `new_request_clicked` on the New Request button and `request_table_row_clicked` on request table rows. |
| `packages/site/app/instructors-view.tsx` | Added `course_created` on successful course creation, `requests_exported` on CSV export, and `request_table_row_clicked` on request table rows. |
| `packages/site/components/requests/request-form.tsx` | Added `request_submitted` (with `request_id`, `request_type`) on success and `request_submission_failed` + `posthog.captureException()` on error. |
| `packages/site/components/requests/response-form.tsx` | Added `response_submitted` (with `request_id`, `request_type`, `decision`) on success and `response_submission_failed` + `posthog.captureException()` on error. |
| `packages/site/components/instructor/admin/enrollment-manager.tsx` | Added `enrollment_added` (with `course_id`, `enrollment_count`, `role`, `section`) after successful bulk enrollment creation. |

## Event tracking summary

| Event | Description | File |
|-------|-------------|------|
| `user_login_initiated` | Fired when a user initiates the Microsoft Entra ID login flow | `app/login/page.tsx` |
| `new_request_clicked` | Fired when a student clicks the "New Request" button | `app/students-view.tsx` |
| `request_table_row_clicked` | Fired when a user clicks a request row to view details (student or instructor view) | `app/students-view.tsx`, `app/instructors-view.tsx` |
| `request_submitted` | Fired when a student successfully submits a new request | `components/requests/request-form.tsx` |
| `request_submission_failed` | Fired when a student's request submission fails with an error | `components/requests/request-form.tsx` |
| `response_submitted` | Fired when an instructor successfully submits a response (Approve/Reject) | `components/requests/response-form.tsx` |
| `response_submission_failed` | Fired when an instructor's response submission fails with an error | `components/requests/response-form.tsx` |
| `course_created` | Fired when an admin successfully creates a new course | `app/instructors-view.tsx` |
| `requests_exported` | Fired when an instructor exports requests as a CSV file | `app/instructors-view.tsx` |
| `enrollment_added` | Fired when an admin adds one or more enrollment entries to a course section | `components/instructor/admin/enrollment-manager.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/321235/dashboard/1300770
  - **Request Submission Funnel** — Conversion from "New Request" click to successful submission: https://us.posthog.com/project/321235/insights/ukd1pZo8
  - **Requests & Responses Over Time** — Daily trend of student requests vs instructor responses: https://us.posthog.com/project/321235/insights/ZHV2PBPF
  - **Request Types Breakdown** — Bar chart of submitted requests by type (Swap Section / Absent from Section / Deadline Extension): https://us.posthog.com/project/321235/insights/rbxpRQ9Y
  - **Request Submission Errors** — Daily count of request and response submission failures: https://us.posthog.com/project/321235/insights/61WC3rL9
  - **Daily Active Users vs Requests** — Logins initiated vs unique users submitting requests each day: https://us.posthog.com/project/321235/insights/Kv4xdOUB

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/posthog-integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
