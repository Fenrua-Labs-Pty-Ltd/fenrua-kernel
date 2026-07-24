# @fenrua/sdk – Thin TypeScript Wrapper

> **Research-grade only. Not production-approved.**

This is a minimal TypeScript SDK that wraps the Fenrua Kernel so normal developers can call `prove()` and `verify()` with one-liners.

## Quick start

```bash
# from the kernel root
pnpm install
cd sdk
npm install   # or pnpm install
npx tsc
node --loader ts-node/esm example.ts
```

## API

```ts
import { prove, verify } from "@fenrua/sdk";

const receipt = prove({ statement: "genesis-09-order-add-exact-wrap" });
const ok = verify({ receipt });
```

## What this does **not** claim

- No message binding
- No authorization
- No production security guarantees

It only makes the existing research kernel easier to call so the community can test, break, and judge it.

**Evidence Before Authority.**
