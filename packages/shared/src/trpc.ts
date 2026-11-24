/**
 * tRPC Router Type Definitions
 * This provides the AppRouter type for type-safe tRPC clients
 * The actual router implementation is in apps/api/src/trpc/
 */

// Simple AppRouter type for client-side use
// The actual router with full types is defined in apps/api
// We use `any` here to allow the client to compile without the full router type
// At runtime, the types are inferred from the API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppRouter = any;

// Type helpers for client-side inference (loose types for compilation)
export type RouterInputs = Record<string, unknown>;
export type RouterOutputs = Record<string, unknown>;