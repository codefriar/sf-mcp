import { execSync } from 'child_process';
import { z } from 'zod';
import { formatFlags } from './utils.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
/**
 * List of topics to ignore during command discovery
 */
const IGNORED_TOPICS = ['help', 'which', 'whatsnew', 'alias'];
/**
 * Path to the cache file
 */
const CACHE_DIR = path.join(os.homedir(), '.sf-mcp');
const CACHE_FILE = path.join(CACHE_DIR, 'command-cache.json');
const CACHE_MAX_AGE = 86400 * 7 * 1000; // 1 week in milliseconds
/**
 * Clear the command cache
 */
export function clearCommandCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            fs.unlinkSync(CACHE_FILE);
            console.error(`Removed cache file: ${CACHE_FILE}`);
            return true;
        }
        else {
            console.error(`Cache file does not exist: ${CACHE_FILE}`);
            return false;
        }
    }
    catch (error) {
        console.error('Error clearing command cache:', error);
        return false;
    }
}
/**
 * Manually force the cache to refresh
 */
export function refreshCommandCache() {
    try {
        // Clear existing cache
        if (fs.existsSync(CACHE_FILE)) {
            fs.unlinkSync(CACHE_FILE);
        }
        // Create a fresh cache
        console.error('Refreshing SF command cache...');
        // Get all commands directly from sf commands --json
        const commands = getAllSfCommands();
        console.error(`Found ${commands.length} total commands for cache refresh`);
        // Save the cache
        saveCommandCache(commands);
        console.error('Cache refresh complete!');
        return true;
    }
    catch (error) {
        console.error('Error refreshing command cache:', error);
        return false;
    }
}
// Get the full path to the sf command
const SF_BINARY_PATH = (() => {
    try {
        // Try to find the sf binary in common locations
        const possiblePaths = [
            '/Users/kpoorman/.volta/bin/sf', // The path we found earlier
            '/usr/local/bin/sf',
            '/usr/bin/sf',
            '/opt/homebrew/bin/sf',
            process.env.HOME + '/.npm/bin/sf',
            process.env.HOME + '/bin/sf',
            process.env.HOME + '/.nvm/versions/node/*/bin/sf',
        ];
        for (const path of possiblePaths) {
            try {
                if (execSync(`[ -x "${path}" ] && echo "exists"`, {
                    encoding: 'utf8',
                }).trim() === 'exists') {
                    return path;
                }
            }
            catch (e) {
                // Path doesn't exist or isn't executable, try the next one
            }
        }
        // If we didn't find it in a known location, try to get it from the PATH
        return 'sf';
    }
    catch (e) {
        console.error("Unable to locate sf binary, falling back to 'sf'");
        return 'sf';
    }
})();
const projectRoots = [];
let defaultRootPath = null;
/**
 * Validate a directory is a valid Salesforce project
 * @param directory The directory to validate
 * @returns boolean indicating if valid
 */
function isValidSalesforceProject(directory) {
    const projectFilePath = path.join(directory, 'sfdx-project.json');
    return fs.existsSync(directory) && fs.existsSync(projectFilePath);
}
/**
 * Get all configured project roots
 * @returns Array of project roots
 */
export function getProjectRoots() {
    return [...projectRoots];
}
/**
 * Get the default project directory (for backward compatibility)
 * @returns The default project directory or null if none set
 */
export function getDefaultProjectDirectory() {
    return defaultRootPath;
}
/**
 * Set the Salesforce project directory to use for commands
 * @param directory The directory containing sfdx-project.json
 * @param options Optional parameters (name, description, isDefault)
 * @returns boolean indicating success
 */
export function setProjectDirectory(directory, options = {}) {
    try {
        // Validate that the directory exists and contains an sfdx-project.json file
        if (!isValidSalesforceProject(directory)) {
            console.error(`Invalid Salesforce project: ${directory}`);
            return false;
        }
        // Check if this root already exists
        const existingIndex = projectRoots.findIndex(root => root.path === directory);
        if (existingIndex >= 0) {
            // Update existing root with new options
            projectRoots[existingIndex] = {
                ...projectRoots[existingIndex],
                ...options,
                path: directory
            };
            // If this is now the default root, update defaultRootPath
            if (options.isDefault) {
                // Remove default flag from other roots
                projectRoots.forEach((root, idx) => {
                    if (idx !== existingIndex) {
                        root.isDefault = false;
                    }
                });
                defaultRootPath = directory;
            }
            console.error(`Updated Salesforce project root: ${directory}`);
        }
        else {
            // Add as new root
            const isDefault = options.isDefault ?? (projectRoots.length === 0);
            projectRoots.push({
                path: directory,
                name: options.name || path.basename(directory),
                description: options.description,
                isDefault
            });
            // If this is now the default root, update defaultRootPath
            if (isDefault) {
                // Remove default flag from other roots
                projectRoots.forEach((root, idx) => {
                    if (idx !== projectRoots.length - 1) {
                        root.isDefault = false;
                    }
                });
                defaultRootPath = directory;
            }
            console.error(`Added Salesforce project root: ${directory}`);
        }
        // Always ensure we have exactly one default root if any roots exist
        if (projectRoots.length > 0 && !projectRoots.some(root => root.isDefault)) {
            projectRoots[0].isDefault = true;
            defaultRootPath = projectRoots[0].path;
        }
        return true;
    }
    catch (error) {
        console.error('Error setting project directory:', error);
        return false;
    }
}
/**
 * Checks if a command requires a Salesforce project context
 * @param command The SF command to check
 * @returns True if the command requires a Salesforce project context
 */
function requiresSalesforceProjectContext(command) {
    // List of commands or command prefixes that require a Salesforce project context
    const projectContextCommands = [
        'project deploy',
        'project retrieve',
        'project delete',
        'project convert',
        'package version create',
        'package1 version create',
        'source',
        'mdapi',
        'apex',
        'lightning',
        'schema generate'
    ];
    // Check if the command matches any of the project context commands
    return projectContextCommands.some(contextCmd => command.startsWith(contextCmd));
}
/**
 * Execute an sf command and return the results
 * @param command The sf command to run
 * @param rootName Optional specific root name to use for execution
 * @returns The stdout output from the command
 */
export function executeSfCommand(command, rootName) {
    try {
        console.error(`Executing: ${SF_BINARY_PATH} ${command}`);
        // Check if target-org parameter is 'default' and replace with the default org
        if (command.includes('--target-org default') || command.includes('--target-org=default')) {
            // Get the default org from sf org list
            const orgListOutput = execSync(`"${SF_BINARY_PATH}" org list --json`, {
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024,
            });
            const orgList = JSON.parse(orgListOutput);
            let defaultUsername = '';
            // Look for the default org across different org types
            for (const orgType of ['nonScratchOrgs', 'scratchOrgs', 'sandboxes']) {
                if (orgList.result[orgType]) {
                    const defaultOrg = orgList.result[orgType].find((org) => org.isDefaultUsername);
                    if (defaultOrg) {
                        defaultUsername = defaultOrg.username;
                        break;
                    }
                }
            }
            if (defaultUsername) {
                // Replace 'default' with the actual default org username
                command = command.replace(/--target-org[= ]default/, `--target-org ${defaultUsername}`);
                console.error(`Using default org: ${defaultUsername}`);
            }
        }
        // Determine which project directory to use
        let projectDir = null;
        // If rootName specified, find that specific root
        if (rootName) {
            const root = projectRoots.find(r => r.name === rootName);
            if (root) {
                projectDir = root.path;
                console.error(`Using specified root "${rootName}" at ${projectDir}`);
            }
            else {
                console.error(`Root "${rootName}" not found, falling back to default root`);
                // Fall back to default
                projectDir = defaultRootPath;
            }
        }
        else {
            // Use default root
            projectDir = defaultRootPath;
        }
        // Check if this command requires a Salesforce project context and we don't have a project directory
        if (requiresSalesforceProjectContext(command) && !projectDir) {
            return `This command requires a Salesforce project context (sfdx-project.json).
Please specify a project directory using the format:
"Execute in <directory_path>" or "Use project in <directory_path>"`;
        }
        try {
            // Always execute in project directory if available
            if (projectDir) {
                console.error(`Executing command in Salesforce project directory: ${projectDir}`);
                // Execute the command within the specified project directory
                const result = execSync(`"${SF_BINARY_PATH}" ${command}`, {
                    encoding: 'utf8',
                    maxBuffer: 10 * 1024 * 1024,
                    env: {
                        ...process.env,
                        PATH: process.env.PATH,
                    },
                    cwd: projectDir,
                    stdio: ['pipe', 'pipe', 'pipe'] // Capture stderr too
                });
                console.error('Command execution successful');
                return result;
            }
            else {
                // Standard execution for when no project directory is set
                return execSync(`"${SF_BINARY_PATH}" ${command}`, {
                    encoding: 'utf8',
                    maxBuffer: 10 * 1024 * 1024,
                    env: {
                        ...process.env,
                        PATH: process.env.PATH,
                    },
                });
            }
        }
        catch (execError) {
            console.error(`Error executing command: ${execError.message}`);
            // Capture both stdout and stderr for better error diagnostics
            let errorOutput = '';
            if (execError.stdout) {
                errorOutput += execError.stdout;
            }
            if (execError.stderr) {
                errorOutput += `\n\nError details: ${execError.stderr}`;
            }
            if (errorOutput) {
                console.error(`Command output: ${errorOutput}`);
                return errorOutput;
            }
            return `Error executing command: ${execError.message}`;
        }
    }
    catch (error) {
        console.error(`Top-level error executing command: ${error.message}`);
        // Capture both stdout and stderr 
        let errorOutput = '';
        if (error.stdout) {
            errorOutput += error.stdout;
        }
        if (error.stderr) {
            errorOutput += `\n\nError details: ${error.stderr}`;
        }
        if (errorOutput) {
            console.error(`Command output: ${errorOutput}`);
            return errorOutput;
        }
        return `Error executing command: ${error.message}`;
    }
}
/**
 * Get all Salesforce CLI commands using 'sf commands --json'
 */
function getAllSfCommands() {
    try {
        console.error("Fetching all SF CLI commands via 'sf commands --json'...");
        // Execute the command to get all commands in JSON format
        const commandsJson = executeSfCommand('commands --json');
        const allCommands = JSON.parse(commandsJson);
        console.error(`Found ${allCommands.length} total commands from 'sf commands --json'`);
        // Filter out commands from ignored topics
        const filteredCommands = allCommands.filter((cmd) => {
            if (!cmd.id)
                return false;
            // For commands with colons (topic:command format), check if the topic should be ignored
            if (cmd.id.includes(':')) {
                const topic = cmd.id.split(':')[0].toLowerCase();
                return !IGNORED_TOPICS.includes(topic);
            }
            // For standalone commands, check if the command itself should be ignored
            return !IGNORED_TOPICS.includes(cmd.id.toLowerCase());
        });
        console.error(`After filtering ignored topics, ${filteredCommands.length} commands remain`);
        // Transform JSON commands to SfCommand format
        const sfCommands = filteredCommands.map((jsonCmd) => {
            // Parse the command structure from its ID
            const commandParts = jsonCmd.id.split(':');
            const isTopicCommand = commandParts.length > 1;
            // For commands like "apex:run", extract name and topic
            let commandName = isTopicCommand ? commandParts[commandParts.length - 1] : jsonCmd.id;
            let topic = isTopicCommand ? commandParts.slice(0, commandParts.length - 1).join(':') : undefined;
            // The full command with spaces instead of colons for execution
            const fullCommand = jsonCmd.id.replace(/:/g, ' ');
            // Convert flags from JSON format to SfFlag format
            const flags = Object.entries(jsonCmd.flags || {}).map(([flagName, flagDetails]) => {
                return {
                    name: flagName,
                    char: flagDetails.char,
                    description: flagDetails.description || '',
                    required: !!flagDetails.required,
                    type: flagDetails.type || 'string',
                    options: flagDetails.options,
                    default: flagDetails.default,
                };
            });
            return {
                id: jsonCmd.id,
                name: commandName,
                description: jsonCmd.summary || jsonCmd.description || jsonCmd.id,
                fullCommand,
                flags,
                topic,
            };
        });
        console.error(`Successfully processed ${sfCommands.length} commands`);
        return sfCommands;
    }
    catch (error) {
        console.error('Error getting SF commands:', error);
        return [];
    }
}
/**
 * Convert an SF command to a schema object for validation
 */
function commandToZodSchema(command) {
    const schemaObj = {};
    for (const flag of command.flags) {
        let flagSchema;
        // Convert flag type to appropriate Zod schema
        switch (flag.type) {
            case 'number':
            case 'integer':
            case 'int':
                flagSchema = z.number();
                break;
            case 'boolean':
            case 'flag':
                flagSchema = z.boolean();
                break;
            case 'array':
            case 'string[]':
                flagSchema = z.array(z.string());
                break;
            case 'json':
            case 'object':
                flagSchema = z.union([z.string(), z.record(z.any())]);
                break;
            case 'file':
            case 'directory':
            case 'filepath':
            case 'path':
            case 'email':
            case 'url':
            case 'date':
            case 'datetime':
            case 'id':
            default:
                // For options-based flags, create an enum schema
                if (flag.options && flag.options.length > 0) {
                    flagSchema = z.enum(flag.options);
                }
                else {
                    flagSchema = z.string();
                }
        }
        // Add description
        if (flag.description) {
            flagSchema = flagSchema.describe(flag.description);
        }
        // Make required or optional based on flag definition
        schemaObj[flag.name] = flag.required ? flagSchema : flagSchema.optional();
    }
    return schemaObj;
}
/**
 * Get the SF CLI version to use for cache validation
 */
function getSfVersion() {
    try {
        const versionOutput = executeSfCommand('--version');
        const versionMatch = versionOutput.match(/sf\/(\d+\.\d+\.\d+)/);
        return versionMatch ? versionMatch[1] : 'unknown';
    }
    catch (error) {
        console.error('Error getting SF version:', error);
        return 'unknown';
    }
}
/**
 * Saves the SF command data to cache
 */
function saveCommandCache(commands) {
    try {
        // Create cache directory if it doesn't exist
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        const sfVersion = getSfVersion();
        const cache = {
            version: sfVersion,
            timestamp: Date.now(),
            commands,
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        console.error(`Command cache saved to ${CACHE_FILE} (SF version: ${sfVersion})`);
    }
    catch (error) {
        console.error('Error saving command cache:', error);
    }
}
/**
 * Loads the SF command data from cache
 * Returns null if cache is missing, invalid, or expired
 */
function loadCommandCache() {
    try {
        if (!fs.existsSync(CACHE_FILE)) {
            console.error('Command cache file does not exist');
            return null;
        }
        const cacheData = fs.readFileSync(CACHE_FILE, 'utf8');
        const cache = JSON.parse(cacheData);
        // Validate cache structure
        if (!cache.version || !cache.timestamp || !Array.isArray(cache.commands)) {
            console.error('Invalid cache structure');
            return null;
        }
        // Check if cache is expired
        const now = Date.now();
        if (now - cache.timestamp > CACHE_MAX_AGE) {
            console.error('Cache is expired');
            return null;
        }
        // Verify that SF version matches
        const currentVersion = getSfVersion();
        if (cache.version !== currentVersion) {
            console.error(`Cache version mismatch. Cache: ${cache.version}, Current: ${currentVersion}`);
            return null;
        }
        console.error(`Using command cache from ${new Date(cache.timestamp).toLocaleString()} (SF version: ${cache.version})`);
        console.error(`Found ${cache.commands.length} commands in cache`);
        return cache.commands;
    }
    catch (error) {
        console.error('Error loading command cache:', error);
        return null;
    }
}
/**
 * Register all SF commands as MCP tools
 * @returns The total number of registered tools
 */
export async function registerSfCommands(server) {
    try {
        console.error('Starting SF command registration');
        // Try to load commands from cache first
        let sfCommands = loadCommandCache();
        // If cache doesn't exist or is invalid, fetch commands directly
        if (!sfCommands) {
            console.error('Cache not available or invalid, fetching commands directly');
            sfCommands = getAllSfCommands();
            // Save to cache for future use
            saveCommandCache(sfCommands);
        }
        // List of manually defined tools to avoid conflicts
        // Only includes the utility cache management tools
        const reservedTools = ['sf_cache_clear', 'sf_cache_refresh'];
        // Keep track of registered tools and aliases to avoid duplicates
        const registeredTools = new Set(reservedTools);
        const registeredAliases = new Set();
        // Register all commands as tools
        let toolCount = 0;
        for (const command of sfCommands) {
            try {
                // Create appropriate MCP-valid tool name
                let toolName;
                if (command.topic) {
                    // For commands with topics, format as "sf_topic_command"
                    toolName = `sf_${command.topic.replace(/:/g, '_')}_${command.name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
                }
                else {
                    // Standalone commands - sf_command
                    toolName = `sf_${command.name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
                }
                // Ensure tool name meets length requirements (1-64 characters)
                if (toolName.length > 64) {
                    toolName = toolName.substring(0, 64);
                }
                // Skip if this tool name conflicts with a manually defined tool or is already registered
                if (registeredTools.has(toolName)) {
                    console.error(`Skipping ${toolName} because it's already registered`);
                    continue;
                }
                const zodSchema = commandToZodSchema(command);
                // Register the command as a tool with description
                server.tool(toolName, command.description, zodSchema, async (flags) => {
                    const flagsStr = formatFlags(flags);
                    const commandStr = `${command.fullCommand} ${flagsStr}`;
                    console.error(`Executing: sf ${commandStr}`);
                    try {
                        const output = executeSfCommand(commandStr);
                        // Check if the output indicates an error but was returned as normal output
                        if (output && (output.includes('Error executing command') || output.includes('Error details:'))) {
                            console.error(`Command returned error: ${output}`);
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: output,
                                    },
                                ],
                                isError: true,
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: output,
                                },
                            ],
                        };
                    }
                    catch (error) {
                        console.error(`Error executing ${commandStr}:`, error);
                        const errorMessage = error.stdout || error.stderr || error.message || 'Unknown error';
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Error: ${errorMessage}`,
                                },
                            ],
                            isError: true,
                        };
                    }
                });
                // Add to registered tools set and increment counter
                registeredTools.add(toolName);
                toolCount++;
                // For nested commands, create simplified aliases when possible
                // (e.g., sf_get for sf_apex_log_get)
                if (command.topic && command.topic.includes(':') && command.name.length > 2) {
                    const simplifiedName = command.name.toLowerCase();
                    const simplifiedToolName = `sf_${simplifiedName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
                    // Skip if the simplified name is already registered as a tool or alias
                    if (registeredTools.has(simplifiedToolName) || registeredAliases.has(simplifiedToolName)) {
                        continue;
                    }
                    // Register simplified alias with description
                    try {
                        server.tool(simplifiedToolName, `Alias for ${command.description}`, zodSchema, async (flags) => {
                            const flagsStr = formatFlags(flags);
                            const commandStr = `${command.fullCommand} ${flagsStr}`;
                            console.error(`Executing (via alias ${simplifiedToolName}): sf ${commandStr}`);
                            try {
                                const output = executeSfCommand(commandStr);
                                // Check if the output indicates an error but was returned as normal output
                                if (output && (output.includes('Error executing command') || output.includes('Error details:'))) {
                                    console.error(`Command returned error: ${output}`);
                                    return {
                                        content: [
                                            {
                                                type: 'text',
                                                text: output,
                                            },
                                        ],
                                        isError: true,
                                    };
                                }
                                return {
                                    content: [
                                        {
                                            type: 'text',
                                            text: output,
                                        },
                                    ],
                                };
                            }
                            catch (error) {
                                console.error(`Error executing ${commandStr}:`, error);
                                const errorMessage = error.stdout || error.stderr || error.message || 'Unknown error';
                                return {
                                    content: [
                                        {
                                            type: 'text',
                                            text: `Error: ${errorMessage}`,
                                        },
                                    ],
                                    isError: true,
                                };
                            }
                        });
                        // Add alias to tracking sets and increment counter
                        registeredAliases.add(simplifiedToolName);
                        registeredTools.add(simplifiedToolName);
                        toolCount++;
                        console.error(`Registered alias ${simplifiedToolName} for ${toolName}`);
                    }
                    catch (err) {
                        console.error(`Error registering alias ${simplifiedToolName}:`, err);
                    }
                }
            }
            catch (err) {
                console.error(`Error registering tool for command ${command.id}:`, err);
            }
        }
        const totalTools = toolCount + registeredAliases.size;
        console.error(`Registration complete. Registered ${totalTools} tools (${toolCount} commands and ${registeredAliases.size} aliases).`);
        // Return the count for the main server to use
        return totalTools;
    }
    catch (error) {
        console.error('Error registering SF commands:', error);
        return 0;
    }
}
