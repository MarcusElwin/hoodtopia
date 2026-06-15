// Test stub for the `server-only` package. In production Next.js resolves
// `server-only` to a module that throws if imported from a Client Component;
// it has no runtime behaviour on the server. Under vitest there's no Next
// bundler to resolve it, so we alias it here to an empty module.
export {};
