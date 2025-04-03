#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { registerSfCommands, clearCommandCache, refreshCommandCache, setProjectDirectory } from './sfCommands.js';
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
// Tools for managing Salesforce project directories
// Tool for automatically detecting project directories from messages
server.tool('sf_detect_project_directory', {}, async () => {
    // Since we can't access the message in this version of MCP,
    // we need to rely on the LLM to extract the directory and use sf_set_project_directory
    return {
        content: [
            {
                type: 'text',
                text: 'To set a project directory, please use sf_set_project_directory with the path to your Salesforce project, or include the project path in your message using formats like "Execute in /path/to/project" or "Use project in /path/to/project".',
            },
        ],
    };
});
// Tool for explicitly setting a project directory
server.tool('sf_set_project_directory', {
    directory: z.string().describe('The absolute path to a directory containing an sfdx-project.json file')
}, async (params) => {
    // Set the project directory (using either explicitly provided or detected directory)
    const result = setProjectDirectory(params.directory);
    return {
        content: [
            {
                type: 'text',
                text: result
                    ? `Successfully set Salesforce project directory to: ${params.directory}`
                    : `Failed to set project directory. Make sure the path exists and contains an sfdx-project.json file.`,
            },
        ],
    };
});
// Start the server with stdio transport
// We can't use middleware, so we'll rely on explicit tool use
// The LLM will need to be instructed to look for project directory references
// and call the sf_set_project_directory tool
async function main() {
    try {
        // Register documentation resources
        registerResources(server);
        // Register all SF CLI commands as tools (dynamic discovery)
        const dynamicToolCount = await registerSfCommands(server);
        // Add the 4 utility tools we registered manually
        const totalTools = dynamicToolCount + 4; // sf_cache_clear, sf_cache_refresh, sf_set_project_directory, sf_detect_project_directory
        console.error(`Total registered tools: ${totalTools} (${dynamicToolCount} SF CLI tools + 4 utility tools)`);
        console.error('Starting Salesforce CLI MCP Server...');
        const transport = new StdioServerTransport();
        await server.connect(transport);
    }
    catch (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    }
}
main();
