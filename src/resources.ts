import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeSfCommand, getProjectRoots } from './sfCommands.js';

/**
 * Register all resources for the SF CLI MCP Server
 */
export function registerResources(server: McpServer): void {
    // Main CLI documentation
    server.resource('sf-help', 'sf://help', async (uri) => ({
        contents: [
            {
                uri: uri.href,
                text: executeSfCommand('-h'),
            },
        ],
    }));

    // Project roots information
    server.resource('sf-roots', 'sf://roots', async (uri) => {
        const roots = getProjectRoots();
        const rootsText = roots.length > 0 
            ? roots.map(root => `${root.name}${root.isDefault ? ' (default)' : ''}: ${root.path}${root.description ? ` - ${root.description}` : ''}`).join('\n')
            : 'No project roots configured. Use sf_set_project_directory to add a project root.';
        
        return {
            contents: [
                {
                    uri: uri.href,
                    text: rootsText,
                },
            ],
        };
    });

    // Topic help documentation
    server.resource(
        'sf-topic-help',
        new ResourceTemplate('sf://topics/{topic}/help', { list: undefined }),
        async (uri, { topic }) => ({
            contents: [
                {
                    uri: uri.href,
                    text: executeSfCommand(`${topic} -h`),
                },
            ],
        })
    );

    // Command help documentation
    server.resource(
        'sf-command-help',
        new ResourceTemplate('sf://commands/{command}/help', { list: undefined }),
        async (uri, { command }) => ({
            contents: [
                {
                    uri: uri.href,
                    text: executeSfCommand(`${command} -h`),
                },
            ],
        })
    );

    // Topic-command help documentation
    server.resource(
        'sf-topic-command-help',
        new ResourceTemplate('sf://topics/{topic}/commands/{command}/help', {
            list: undefined,
        }),
        async (uri, { topic, command }) => ({
            contents: [
                {
                    uri: uri.href,
                    text: executeSfCommand(`${topic} ${command} -h`),
                },
            ],
        })
    );

    // Root-specific command help (execute in a specific root)
    server.resource(
        'sf-root-command',
        new ResourceTemplate('sf://roots/{root}/commands/{command}', { list: undefined }),
        async (uri, { root, command }) => ({
            contents: [
                {
                    uri: uri.href,
                    // Ensure command is treated as string
                    text: executeSfCommand(String(command), String(root)),
                },
            ],
        })
    );

    // Version information
    server.resource('sf-version', 'sf://version', async (uri) => ({
        contents: [
            {
                uri: uri.href,
                text: executeSfCommand('--version'),
            },
        ],
    }));
}
