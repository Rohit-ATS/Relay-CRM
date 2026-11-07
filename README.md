# Relay CRM

Shared contracts for UI and server routes live in [`src/shared/contracts.ts`](src/shared/contracts.ts).

```ts
import { accountSchema, type Account, createSequencePayloadSchema } from "@/shared/contracts";
```

Use the exported Zod schemas to validate request bodies and persisted records at runtime.

## Run the demo

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Imported records persist in browser `localStorage`.
