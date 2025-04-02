#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerSfCommands, clearCommandCache, refreshCommandCache } from './sfCommands.js';
import { registerResources } from './resources.js';

// Create an MCP server
const server = new McpServer({
    name: 'Salesforce CLI MCP',
    version: '1.1.0',
    description: 'MCP server for Salesforce CLI integration',
});

// Only register utility tools that aren't SF CLI commands
// These are utility functions that extend or manage the MCP server itself
server.tool('sf_cache_clear', {}, async () => {
    const result = clearCommandCache();
    return {
        content: [
            {
                type: 'text',
                text: result
                    ? 'Command cache cleared successfully.'
                    : 'Failed to clear command cache or cache did not exist.',
            },
        ]
    };
});

server.tool('sf_cache_refresh', {}, async () => {
    const result = refreshCommandCache();
    return {
        content: [
            {
                type: 'text',
                text: result
                    ? 'Command cache refreshed successfully. Restart the server to use the new cache.'
                    : 'Failed to refresh command cache.',
            },
        ],
    };
});

// Start the server with stdio transport
async function main() {
    try {
        // Register documentation resources
        registerResources(server);

        // Register all SF CLI commands as tools (dynamic discovery)
        const dynamicToolCount = await registerSfCommands(server);

        // Add the 2 utility tools we registered manually
        const totalTools = dynamicToolCount + 2;
        console.error(`Total registered tools: ${totalTools} (${dynamicToolCount} SF CLI tools + 2 utility tools)`);

        console.error('Starting Salesforce CLI MCP Server...');
        const transport = new StdioServerTransport();
        await server.connect(transport);
    } catch (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    }
}

main();
