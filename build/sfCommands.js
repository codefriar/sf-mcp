import { execSync } from "child_process";
import { z } from "zod";
import { formatFlags } from "./utils.js";
import fs from "fs";
import path from "path";
import os from "os";
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
        console.error("Error clearing command cache:", error);
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
        console.error("Refreshing SF command cache...");
        // Get all commands directly from sf commands --json
        const commands = getAllSfCommands();
        console.error(`Found ${commands.length} total commands for cache refresh`);
        // Save the cache
        saveCommandCache(commands);
        console.error("Cache refresh complete!");
        return true;
    }
    catch (error) {
        console.error("Error refreshing command cache:", error);
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
            process.env.HOME + '/.nvm/versions/node/*/bin/sf'
        ];
        for (const path of possiblePaths) {
            try {
                if (execSync(`[ -x "${path}" ] && echo "exists"`, { encoding: 'utf8' }).trim() === 'exists') {
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
/**
 * Execute an sf command and return the results
 * @param command The sf command to run
 * @returns The stdout output from the command
 */
export function executeSfCommand(command) {
    try {
        console.error(`Executing: ${SF_BINARY_PATH} ${command}`);
        return execSync(`"${SF_BINARY_PATH}" ${command}`, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            env: {
                ...process.env,
                PATH: process.env.PATH
            }
        });
    }
    catch (error) {
        if (error.stdout) {
            return error.stdout;
        }
        throw new Error(`Error executing command: ${error.message}`);
    }
}
/**
 * Get all Salesforce CLI commands using 'sf commands --json'
 */
function getAllSfCommands() {
    try {
        console.error("Fetching all SF CLI commands via 'sf commands --json'...");
        // Execute the command to get all commands in JSON format
        const commandsJson = executeSfCommand("commands --json");
        const allCommands = JSON.parse(commandsJson);
        console.error(`Found ${allCommands.length} total commands from 'sf commands --json'`);
        // Filter out commands from ignored topics
        const filteredCommands = allCommands.filter(cmd => {
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
        const sfCommands = filteredCommands.map(jsonCmd => {
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
                    default: flagDetails.default
                };
            });
            return {
                id: jsonCmd.id,
                name: commandName,
                description: jsonCmd.summary || jsonCmd.description || jsonCmd.id,
                fullCommand,
                flags,
                topic
            };
        });
        console.error(`Successfully processed ${sfCommands.length} commands`);
        return sfCommands;
    }
    catch (error) {
        console.error("Error getting SF commands:", error);
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
        const versionOutput = executeSfCommand("--version");
        const versionMatch = versionOutput.match(/sf\/(\d+\.\d+\.\d+)/);
        return versionMatch ? versionMatch[1] : 'unknown';
    }
    catch (error) {
        console.error("Error getting SF version:", error);
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
            commands
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        console.error(`Command cache saved to ${CACHE_FILE} (SF version: ${sfVersion})`);
    }
    catch (error) {
        console.error("Error saving command cache:", error);
    }
}
/**
 * Loads the SF command data from cache
 * Returns null if cache is missing, invalid, or expired
 */
function loadCommandCache() {
    try {
        if (!fs.existsSync(CACHE_FILE)) {
            console.error("Command cache file does not exist");
            return null;
        }
        const cacheData = fs.readFileSync(CACHE_FILE, 'utf8');
        const cache = JSON.parse(cacheData);
        // Validate cache structure
        if (!cache.version || !cache.timestamp || !Array.isArray(cache.commands)) {
            console.error("Invalid cache structure");
            return null;
        }
        // Check if cache is expired
        const now = Date.now();
        if (now - cache.timestamp > CACHE_MAX_AGE) {
            console.error("Cache is expired");
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
        console.error("Error loading command cache:", error);
        return null;
    }
}
/**
 * Register all SF commands as MCP tools
 * @returns The total number of registered tools
 */
export async function registerSfCommands(server) {
    try {
        console.error("Starting SF command registration");
        // Try to load commands from cache first
        let sfCommands = loadCommandCache();
        // If cache doesn't exist or is invalid, fetch commands directly
        if (!sfCommands) {
            console.error("Cache not available or invalid, fetching commands directly");
            sfCommands = getAllSfCommands();
            // Save to cache for future use
            saveCommandCache(sfCommands);
        }
        // List of manually defined tools to avoid conflicts
        // Only includes the utility cache management tools
        const reservedTools = [
            'sf_cache_clear',
            'sf_cache_refresh'
        ];
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
                // Register the command as a tool
                server.tool(toolName, zodSchema, async (flags) => {
                    const flagsStr = formatFlags(flags);
                    const commandStr = `${command.fullCommand} ${flagsStr}`;
                    console.error(`Executing: sf ${commandStr}`);
                    try {
                        const output = executeSfCommand(commandStr);
                        return {
                            content: [{
                                    type: "text",
                                    text: output
                                }]
                        };
                    }
                    catch (error) {
                        console.error(`Error executing ${commandStr}:`, error);
                        return {
                            content: [{
                                    type: "text",
                                    text: `Error: ${error.message}`
                                }],
                            isError: true
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
                    // Register simplified alias
                    try {
                        server.tool(simplifiedToolName, zodSchema, async (flags) => {
                            const flagsStr = formatFlags(flags);
                            const commandStr = `${command.fullCommand} ${flagsStr}`;
                            console.error(`Executing (via alias ${simplifiedToolName}): sf ${commandStr}`);
                            try {
                                const output = executeSfCommand(commandStr);
                                return {
                                    content: [{
                                            type: "text",
                                            text: output
                                        }]
                                };
                            }
                            catch (error) {
                                console.error(`Error executing ${commandStr}:`, error);
                                return {
                                    content: [{
                                            type: "text",
                                            text: `Error: ${error.message}`
                                        }],
                                    isError: true
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
        console.error("Error registering SF commands:", error);
        return 0;
    }
}
