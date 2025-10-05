# GEMINI CLI Guidelines

This document outlines the mandatory guidelines for interacting with `geminicli`, a command-line interface for managing and developing applications with a React + TypeScript + Tailwind CSS frontend and a robust backend. These guidelines ensure consistency, simplicity, and reliability across all development processes.

---

## 🧩 Updated Folder Structures (API-First Architecture)

### 🔹 Root Folder Structure

```
gemini-project/
├── backend/                  # Node.js + TypeScript backend
├── frontend/                 # React + TypeScript + Tailwind frontend
├── shared/                   # Shared types, constants, utils between front & back
│   ├── types/
│   ├── constants/
│   └── utils/
├── package.json              # Root package for workspace management
├── tsconfig.json             # Root TS config (references frontend/backend)
├── .eslintrc.json
├── .prettierrc
├── .env
└── README.md
```

> Use a monorepo (via `npm workspaces` or `pnpm`) to manage both frontend and backend cleanly. Keep shared types and utilities inside `/shared/` to avoid type drift between layers.

---

### 🔹 Backend (Node.js + TypeScript + Express/Fastify)

```
backend/
├── src/
│   ├── api/
│   │   ├── users/
│   │   │   ├── db.ts              # Only database queries
│   │   │   ├── service.ts         # Business logic
│   │   │   ├── controller.ts      # HTTP handlers
│   │   │   ├── route.ts           # Express route registration
│   │   │   ├── schema.ts          # Zod/Joi validation
│   │   │   ├── types.ts           # Module-specific types
│   │   │   ├── utils.ts           # Helpers specific to this module
│   │   │   └── index.ts
│   │   ├── auth/
│   │   │   ├── db.ts
│   │   │   ├── service.ts
│   │   │   ├── controller.ts
│   │   │   ├── route.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── ... (more APIs)
│   │
│   ├── common/
│   │   ├── dbClient.ts            # Shared DB client (Prisma, Knex, etc.)
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── errorHandler.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   ├── response.ts
│   │   │   └── validate.ts
│   │   ├── constants/
│   │   │   ├── env.ts
│   │   │   └── httpCodes.ts
│   │   └── types/
│   │       ├── api.ts
│   │       ├── enums.ts
│   │       └── utils.ts
│   │
│   ├── routes.ts                  # Registers all routes under /api
│   ├── app.ts                     # Express/Fastify setup
│   └── server.ts                  # Server entry point
│
├── tests/                         # Unit/integration tests
├── package.json
└── tsconfig.json
```

**Rules of Scope:**
- `api/<module>` → completely self-contained (API-first principle).
- `common/` → reusable backend-wide utilities, middlewares, and constants.
- `shared/` (in root) → shared between backend & frontend (types, constants, utilities).

---

### 🔹 Frontend (React + TypeScript + Tailwind)

```
frontend/
├── src/
│   ├── api/
│   │   ├── users/
│   │   │   ├── service.ts         # fetch/axios calls to backend
│   │   │   ├── hooks.ts           # React Query hooks
│   │   │   ├── schema.ts          # zod validation for frontend forms
│   │   │   ├── types.ts           # User-specific types
│   │   │   └── index.ts
│   │   ├── auth/
│   │   │   ├── service.ts
│   │   │   ├── hooks.ts
│   │   │   └── types.ts
│   │   └── ...
│   │
│   ├── components/
│   │   ├── users/
│   │   │   ├── UserCard.tsx
│   │   │   ├── UserForm.tsx
│   │   │   └── index.ts
│   │   ├── ui/                    # Common reusable UI atoms
│   │   ├── layout/                # Layout components (Navbar, Sidebar)
│   │   └── shared/                # Shared components used globally
│   │
│   ├── pages/
│   │   ├── UsersPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── DashboardPage.tsx
│   │
│   ├── hooks/                     # Non-API custom hooks
│   ├── store/                     # Zustand/Redux/TanStack state
│   ├── utils/                     # General utilities (date, string, etc.)
│   ├── constants/                 # App-wide constants
│   ├── styles/                    # Tailwind + global CSS
│   ├── types/                     # Global app-level types
│   ├── App.tsx
│   └── main.tsx
│
├── public/
│   └── index.html
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

**Frontend Rules of Scope:**
- `api/<module>` mirrors backend’s modular API structure.
- `components/<feature>` contain UI tied to that API.
- `hooks/`, `utils/`, and `constants/` start local → move global when reused.

---

### 🔹 Shared (Cross-Layer Reuse)

```
shared/
├── types/
│   ├── user.ts
│   ├── auth.ts
│   ├── api.ts
│   └── index.ts
├── constants/
│   ├── env.ts
│   └── app.ts
└── utils/
    ├── formatDate.ts
    ├── generateId.ts
    └── index.ts
```

**Purpose:**
- Define interfaces and enums used across backend and frontend.
- Maintain a single source of truth for data structures and constants.

---

By following this API-first modular layout, `geminicli` enforces separation of concerns, reusability, and consistency between the backend and frontend. Each API module remains self-contained, while global folders only store cross-cutting logic or shared utilities.