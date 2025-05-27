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

## Project Description

- This project seeks to create a Model Context Protocol Server that tools like Claude code, and Claude desktop can use to directly and intelligently interface with the Salesforce Command Line Interface. (CLI)

## Model Context Protocol (MCP) Architecture

### Core Components
- **Hosts**: LLM applications (Claude Desktop, Claude Code) that initiate connections
- **Clients**: Maintain connections with MCP servers
- **Servers**: Provide context, tools, and prompts (this Salesforce CLI MCP server)

### MCP Primitives for Salesforce Integration

#### Tools
- Executable functions for Salesforce operations
- Dynamic tool discovery and invocation
- Tool annotations (read-only, destructive operations)
- Key Salesforce tools to implement:
  - SOQL query execution
  - Record CRUD operations
  - Metadata deployment/retrieval
  - Org inspection and configuration
  - Apex execution and testing

#### Resources
- Expose Salesforce data and metadata
- Unique URI identification for resources
- Support for text and binary content
- Salesforce resources to expose:
  - Object schemas and field definitions
  - Org configuration and limits
  - Deployment metadata
  - Code coverage reports
  - Flow definitions

#### Prompts
- Reusable prompt templates for Salesforce workflows
- Dynamic arguments for context-aware interactions
- Common Salesforce prompt patterns:
  - Data analysis and reporting
  - Code generation and review
  - Deployment guidance
  - Best practices recommendations

#### Sampling
- Allow server to request LLM completions
- Human-in-the-loop approval for destructive operations
- Fine-grained control over Salesforce operations

### Security Considerations
- Input validation for all Salesforce CLI commands
- Proper authentication with Salesforce orgs
- Rate limiting to respect Salesforce API limits
- Sanitization of external interactions
- Secure handling of sensitive org data

### Transport
- Primary: Stdio (standard input/output)
- Alternative: HTTP with Server-Sent Events (SSE)

### Implementation Strategy
1. Start with core Salesforce CLI tools (query, describe, deploy)
2. Use TypeScript MCP SDK for type safety
3. Implement robust error handling for CLI failures
4. Provide clear tool descriptions and examples
5. Add progressive enhancement for advanced features