# Salesforce CLI MCP Server

Model Context Protocol (MCP) server for providing Salesforce CLI functionality to LLM tools like Claude Desktop.

## Overview

This MCP server wraps the Salesforce CLI (`sf`) command-line tool and exposes its commands as MCP tools and resources, allowing LLM-powered agents to:

- View help information about Salesforce CLI topics and commands
- Execute Salesforce CLI commands with appropriate parameters
- Leverage Salesforce CLI capabilities in AI workflows

## Requirements

- Node.js 18+ and npm
- Salesforce CLI (`sf`) installed and configured
- Your Salesforce org credentials configured in the CLI

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd sfMcp

# Install dependencies
npm install
```

## Usage

### Starting the server

```bash
npm start
```

This will start the MCP server with stdio transport, which can be used with MCP clients like the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) or Claude Desktop.

### Development

```bash
# Watch mode (recompiles on file changes)
npm run dev

# In another terminal
npm start
```

## Available Tools and Resources

This MCP server provides Salesforce CLI commands as MCP tools. It attempts to automatically discover and register all available commands, and also specifically implements the most commonly used commands.

### Core Tools

- `sf_version` - Get the Salesforce CLI version information
- `sf_help` - Get help information for Salesforce CLI commands

### Key Implemented Tools

The following commands are specifically implemented:

- `sf_org_list` - List Salesforce orgs
  - Parameters: `json`, `verbose`

- `sf_auth_list_orgs` - List authenticated Salesforce orgs
  - Parameters: `json`, `verbose`

- `sf_org_display` - Display details about an org
  - Parameters: `targetusername`, `json`
  
- `sf_project_deploy_start` - Deploy source to an org
  - Parameters: `targetusername`, `sourcedir`, `json`, `wait`

### Dynamically Discovered Tools

The server also attempts to discover other available Salesforce CLI commands and register them as tools with format: `sf_<topic>_<command>`.

For example:
- `sf_apex_run` - Run anonymous Apex code
- `sf_data_query` - Execute a SOQL query

The available commands may vary depending on the installed Salesforce CLI plugins.

### Resources

The following resources provide documentation about Salesforce CLI:

- `sf://help` - Main CLI documentation
- `sf://topics/{topic}/help` - Topic help documentation
- `sf://commands/{command}/help` - Command help documentation
- `sf://topics/{topic}/commands/{command}/help` - Topic-command help documentation
- `sf://version` - Version information

## How It Works

1. At startup, the server queries the Salesforce CLI for all available topics and commands
2. Each command's help is parsed to extract parameter metadata
3. All commands are registered as MCP tools with appropriate parameter schemas
4. Resources are registered for help documentation
5. When a tool is called, the corresponding Salesforce CLI command is executed

## License

ISC