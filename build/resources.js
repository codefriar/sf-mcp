import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeSfCommand } from './sfCommands.js';
/**
 * Register all resources for the SF CLI MCP Server
 */
export function registerResources(server) {
    // Main CLI documentation
    server.resource('sf-help', 'sf://help', async (uri) => ({
        contents: [
            {
                uri: uri.href,
                text: executeSfCommand('-h'),
            },
        ],
    }));
    // Topic help documentation
    server.resource('sf-topic-help', new ResourceTemplate('sf://topics/{topic}/help', { list: undefined }), async (uri, { topic }) => ({
        contents: [
            {
                uri: uri.href,
                text: executeSfCommand(`${topic} -h`),
            },
        ],
    }));
    // Command help documentation
    server.resource('sf-command-help', new ResourceTemplate('sf://commands/{command}/help', { list: undefined }), async (uri, { command }) => ({
        contents: [
            {
                uri: uri.href,
                text: executeSfCommand(`${command} -h`),
            },
        ],
    }));
    // Topic-command help documentation
    server.resource('sf-topic-command-help', new ResourceTemplate('sf://topics/{topic}/commands/{command}/help', {
        list: undefined,
    }), async (uri, { topic, command }) => ({
        contents: [
            {
                uri: uri.href,
                text: executeSfCommand(`${topic} ${command} -h`),
            },
        ],
    }));
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
