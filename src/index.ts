#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { registerSfCommands, clearCommandCache, refreshCommandCache, setProjectDirectory, getProjectRoots } from './sfCommands.js';
import path from 'path';
import { registerResources } from './resources.js';
import { extractProjectDirectoryFromMessage } from './utils.js';

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

// Tools for managing Salesforce project directories (roots)

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

// Tool for explicitly setting a project directory (root)
server.tool('sf_set_project_directory', {
    directory: z.string().describe('The absolute path to a directory containing an sfdx-project.json file'),
    name: z.string().optional().describe('Optional name for this project root'),
    description: z.string().optional().describe('Optional description for this project root'),
    isDefault: z.boolean().optional().describe('Set this root as the default for command execution')
}, async (params) => {
    
    // Set the project directory with optional metadata
    const result = setProjectDirectory(params.directory, {
        name: params.name,
        description: params.description,
        isDefault: params.isDefault
    });
    
    return {
        content: [
            {
                type: 'text',
                text: result
                    ? `Successfully set Salesforce project root: ${params.directory}${params.name ? ` with name "${params.name}"` : ''}${params.isDefault ? ' (default)' : ''}`
                    : `Failed to set project directory. Make sure the path exists and contains an sfdx-project.json file.`,
            },
        ],
    };
});

// Tool for listing configured project roots
server.tool('sf_list_roots', {}, async () => {
    const roots = getProjectRoots();
    
    if (roots.length === 0) {
        return {
            content: [
                {
                    type: 'text',
                    text: 'No project roots configured. Use sf_set_project_directory to add a project root.'
                }
            ]
        };
    }
    
    // Format roots list for display
    const rootsList = roots.map(root => (
        `- ${root.name || path.basename(root.path)}${root.isDefault ? ' (default)' : ''}: ${root.path}${root.description ? `\n  Description: ${root.description}` : ''}`
    )).join('\n\n');
    
    return {
        content: [
            {
                type: 'text',
                text: `Configured Salesforce project roots:\n\n${rootsList}`
            }
        ]
    };
});

// Start the server with stdio transport
// We can't use middleware, so we'll rely on explicit tool use
// The LLM will need to be instructed to look for project directory references
// and call the sf_set_project_directory tool

/**
 * Process command line arguments to detect and set project roots
 * All arguments that look like filesystem paths are treated as potential roots
 */
function processRootPaths(): void {
    // Skip the first two arguments (node executable and script path)
    const args = process.argv.slice(2);
    
    if (!args || args.length === 0) {
        console.error('No arguments provided');
        return;
    }

    // Filter arguments that appear to be filesystem paths
    // A path typically starts with / or ./ or ../ or ~/ or contains a directory separator
    const rootPaths = args.filter(arg => 
        arg.startsWith('/') || 
        arg.startsWith('./') || 
        arg.startsWith('../') || 
        arg.startsWith('~/') ||
        arg.includes('/') ||
        arg.includes('\\')
    );
    
    if (rootPaths.length === 0) {
        console.error('No project roots identified in CLI arguments');
        return;
    }

    console.error(`Configuring ${rootPaths.length} project roots from CLI arguments...`);
    
    // Process each provided path
    for (let i = 0; i < rootPaths.length; i++) {
        const rootPath = rootPaths[i];
        const isDefault = i === 0; // Make the first root the default
        const rootName = `root${i + 1}`;
        
        // Set up this root
        const result = setProjectDirectory(rootPath, {
            name: rootName,
            isDefault,
            description: `CLI-configured root #${i + 1}`
        });
        
        if (result) {
            console.error(`Configured project root #${i + 1}: ${rootPath}`);
        } else {
            console.error(`Failed to configure project root #${i + 1}: ${rootPath}`);
        }
    }
}

async function main() {
    try {
        // Process any command line arguments for project roots
        processRootPaths();
        
        // Register documentation resources
        registerResources(server);

        // Register all SF CLI commands as tools (dynamic discovery)
        const dynamicToolCount = await registerSfCommands(server);

        // Add the utility tools we registered manually
        const totalTools = dynamicToolCount + 5; // sf_cache_clear, sf_cache_refresh, sf_set_project_directory, sf_detect_project_directory, sf_list_roots
        console.error(`Total registered tools: ${totalTools} (${dynamicToolCount} SF CLI tools + 5 utility tools)`);

        console.error('Starting Salesforce CLI MCP Server...');
        const transport = new StdioServerTransport();
        await server.connect(transport);
    } catch (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    }
}

main();
