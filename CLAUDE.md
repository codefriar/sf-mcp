# MCP Development Guide

## Build Commands

- Build project: `npm run build`
- Run the MCP server: `node build/index.js`

## Lint & Formatting

- Format with Prettier: `npx prettier --write 'src/**/*.ts'`
- Lint: `npx eslint 'src/**/*.ts'`
- Type check: `npx tsc --noEmit`

## Testing

- Run tests: `npm test`
- Run a single test: `npm test -- -t 'test name'`

## Code Style Guidelines

- Use ES modules (import/export) syntax
- TypeScript strict mode enabled
- Types: Use strong typing with TypeScript interfaces/types
- Naming: camelCase for variables/functions, PascalCase for classes/interfaces
- Error handling: Use try/catch with typed errors
- Imports: Group by 3rd party, then local, alphabetized within groups
- Async: Prefer async/await over raw Promises
- Documentation: JSDoc for public APIs
- Endpoint API naming following MCP conventions for resources/tools/prompts
