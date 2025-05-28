# Salesforce CLI MCP Server

[![smithery badge](https://smithery.ai/badge/@codefriar/sf-mcp)](https://smithery.ai/server/@codefriar/sf-mcp)

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

### Installing via Smithery

To install Salesforce CLI MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@codefriar/sf-mcp):

```bash
npx -y @smithery/cli install @codefriar/sf-mcp --client claude
```

### Manual Installation
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
# Basic usage
npm start

# With project roots
npm start /path/to/project1 /path/to/project2
# or using the convenience script
npm run with-roots /path/to/project1 /path/to/project2

# As an npx package with roots
npx -y codefriar/sf-mcp /path/to/project1 /path/to/project2
```

The MCP server uses stdio transport, which can be used with MCP clients 
like the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) or Claude Desktop.

### Configuring in Claude Desktop

To configure this MCP in Claude Desktop's `.claude.json` configuration:

```json
{
  "tools": {
    "salesforce": {
      "command": "/path/to/node",
      "args": [
        "/path/to/sf-mcp/build/index.js",
        "/path/to/project1",
        "/path/to/project2"
      ]
    }
  }
}
```

Using the npm package directly:

```json
{
  "tools": {
    "salesforce": {
      "command": "/path/to/npx", 
      "args": [
        "-y",
        "codefriar/sf-mcp",
        "/path/to/project1",
        "/path/to/project2"
      ]
    }
  }
}
```

### Development

```bash
# Watch mode (recompiles on file changes)
npm run dev

# In another terminal
npm start [optional project roots...]
```

## Available Tools and Resources

This MCP server provides Salesforce CLI commands as MCP tools. It automatically discovers and registers all available commands from the Salesforce CLI, and also specifically implements the most commonly used commands.

### Core Tools

- `sf_version` - Get the Salesforce CLI version information
- `sf_help` - Get help information for Salesforce CLI commands
- `sf_cache_clear` - Clear the command discovery cache
- `sf_cache_refresh` - Refresh the command discovery cache

### Project Directory Management (Roots)

For commands that require a Salesforce project context (like deployments), you must specify the project directory.
The MCP supports multiple project directories (roots) similar to the filesystem MCP.

#### Configuration Methods

**Method 1: Via Command Line Arguments**
```bash
# Start the MCP with project roots
npm start /path/to/project1 /path/to/project2
# or
npx -y codefriar/sf-mcp /path/to/project1 /path/to/project2
```

When configured this way, the roots will be automatically named `root1`, `root2`, etc., 
with the first one set as default.

**Method 2: Using MCP Tools**
- `sf_set_project_directory` - Set a Salesforce project directory to use for commands
  - Parameters: 
    - `directory` - Path to a directory containing a sfdx-project.json file
    - `name` - (Optional) Name for this project root
    - `description` - (Optional) Description for this project root
    - `isDefault` - (Optional) Set this root as the default for command execution
- `sf_list_roots` - List all configured project roots
- `sf_detect_project_directory` - Attempt to detect project directory from user messages

Example usage:
```
# Set project directory with a name
sf_set_project_directory --directory=/path/to/your/sfdx/project --name=project1 --isDefault=true

# List all configured roots
sf_list_roots

# Or include in your message:
"Please deploy the apex code from the project in /path/to/your/sfdx/project to my scratch org"
```

**Method 3: Claude Desktop Configuration**
Configure project roots in `.claude.json` as described below.

#### Using Project Roots

You can execute commands in specific project roots:
```
# Using resource URI
sf://roots/project1/commands/project deploy start --sourcedir=force-app

# Using rootName parameter
sf_project_deploy_start --sourcedir=force-app --rootName=project1
```

Project directory must be specified for commands such as deployments,
source retrieval, and other project-specific operations. 
If multiple roots are configured, the default root will be used unless otherwise specified.

### Key Implemented Tools

The following commands are specifically implemented and guaranteed to work:

#### Organization Management

- `sf_org_list` - List Salesforce orgs
    - Parameters: `json`, `verbose`
- `sf_auth_list_orgs` - List authenticated Salesforce orgs
    - Parameters: `json`, `verbose`
- `sf_org_display` - Display details about an org
    - Parameters: `targetusername`, `json`
- `sf_org_open` - Open an org in the browser
    - Parameters: `targetusername`, `path`, `urlonly`

#### Apex Code

- `sf_apex_run` - Run anonymous Apex code
    - Parameters: `targetusername`, `file`, `apexcode`, `json`
- `sf_apex_test_run` - Run Apex tests
    - Parameters: `targetusername`, `testnames`, `suitenames`, `classnames`, `json`

#### Data Management

- `sf_data_query` - Execute a SOQL query
    - Parameters: `targetusername`, `query`, `json`
- `sf_schema_list_objects` - List sObjects in the org
    - Parameters: `targetusername`, `json`
- `sf_schema_describe` - Describe a Salesforce object
    - Parameters: `targetusername`, `sobject`, `json`

#### Deployment

- `sf_project_deploy_start` - Deploy the source to an org
    - Parameters: `targetusername`, `sourcedir`, `json`, `wait`

### Dynamically Discovered Tools

The server discovers all available Salesforce CLI commands and registers them as tools with format: `sf_<topic>_<command>`.

For example:

- `sf_apex_run` - Run anonymous Apex code
- `sf_data_query` - Execute a SOQL query

For nested topic commands, the tool name includes the full path with underscores:

- `sf_apex_log_get` - Get apex logs
- `sf_org_login_web` - Login to an org using web flow

The server also creates simplified aliases for common nested commands where possible:

- `sf_get` as an alias for `sf_apex_log_get`
- `sf_web` as an alias for `sf_org_login_web`

The available commands vary depending on the installed Salesforce CLI plugins.

> **Note:** Command discovery is cached to improve startup performance. If you install new SF CLI plugins, use the `sf_cache_refresh` tool to update the cache, then restart the server.

### Resources

The following resources provide documentation about Salesforce CLI:

- `sf://help` - Main CLI documentation
- `sf://topics/{topic}/help` - Topic help documentation
- `sf://commands/{command}/help` - Command help documentation
- `sf://topics/{topic}/commands/{command}/help` - Topic-command help documentation
- `sf://version` - Version information
- `sf://roots` - List all configured project roots
- `sf://roots/{root}/commands/{command}` - Execute a command in a specific project root

## How It Works

1. At startup, the server checks for a cached list of commands (stored in `~/.sf-mcp/command-cache.json`)
2. If a valid cache exists, it's used to register commands; otherwise, commands are discovered dynamically
3. During discovery, the server queries `sf commands --json` to get a complete list of available commands
4. Command metadata (including parameters and descriptions) is extracted directly from the JSON output
5. All commands are registered as MCP tools with appropriate parameter schemas
6. Resources are registered for help documentation
7. When a tool is called, the corresponding Salesforce CLI command is executed

### Project Roots Management

For commands that require a Salesforce project context:

1. The server checks if any project roots have been configured via `sf_set_project_directory`
2. If multiple roots are configured, it uses the default root unless a specific root is specified
3. If no roots are set, the server will prompt the user to specify a project directory
4. Commands are executed within the appropriate project directory, ensuring proper context
5. The user can add or switch between multiple project roots as needed

Project-specific commands (like deployments, retrievals, etc.) 
will automatically run in the appropriate project directory. 
For commands that don't require a project context, the working directory doesn't matter.

You can execute commands in specific project roots by:
- Using the resource URI: `sf://roots/{rootName}/commands/{command}`
- Providing a `rootName` parameter to command tools (internal implementation details)
- Setting a specific root as the default with `sf_set_project_directory --isDefault=true`

### Command Caching

To improve startup performance, the MCP server caches discovered commands:

- The cache is stored in `~/.sf-mcp/command-cache.json`
- It includes all topics, commands, parameters, and descriptions
- The cache has a validation timestamp and SF CLI version check
- By default, the cache expires after 7 days
- When you install new Salesforce CLI plugins, use `sf_cache_refresh` to update the cache

#### Troubleshooting Cache Issues

The first run of the server performs a full command discovery which can take some time. If you encounter any issues with missing commands or cache problems:

1. Stop the MCP server (if running)
2. Manually delete the cache file: `rm ~/.sf-mcp/command-cache.json`
3. Start the server again: `npm start`

This will force a complete rediscovery of all commands using the official CLI metadata.

If specific commands are still missing, or you've installed new SF CLI plugins:

1. Use the `sf_cache_refresh` tool from Claude Desktop
2. Stop and restart the MCP server

### Handling Nested Topics

The Salesforce CLI has a hierarchical command structure that can be several levels deep. This MCP server handles these nested commands by:

- Converting colon-separated paths to underscore format (`apex:log:get` → `sf_apex_log_get`)
- Providing aliases for common deep commands when possible (`sf_get` for `sf_apex_log_get`)
- Preserving the full command hierarchy in the tool names
- Using the official command structure from `sf commands --json`

Nested topic commands are registered twice when possible—once with the full hierarchy name and once with a simplified alias,
making them easier to discover and use.

## License

ISC
