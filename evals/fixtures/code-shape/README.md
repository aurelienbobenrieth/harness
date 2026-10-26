# Parcel desk

An in-memory fulfillment service. Node 24 runs the TypeScript directly. Effect 4 is preinstalled.
`node check.mjs scoped` runs tests; `node check.mjs full` runs the same project gate.
`src/api.ts` is the application boundary. Pure price decisions stay in domain modules;
adapters own storage and the carrier transport. Tests use real memory storage and a fake external carrier.
No network, new dependency, publishing, or paid delegation is required.
