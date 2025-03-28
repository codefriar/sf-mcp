/**
 * Utility functions for working with the Salesforce CLI
 */
/**
 * Formats an object as a string representation of CLI flags
 * @param flags Key-value pairs of flag names and values
 * @returns Formatted flags string suitable for command line
 */
export function formatFlags(flags) {
    if (!flags)
        return '';
    return Object.entries(flags).map(([key, value]) => {
        // Skip undefined/null values
        if (value === undefined || value === null)
            return '';
        // Handle boolean flags
        if (typeof value === 'boolean') {
            return value ? `--${key}` : '';
        }
        // Handle arrays (space-separated multi-values)
        if (Array.isArray(value)) {
            return value.map(v => `--${key}=${escapeValue(v)}`).join(' ');
        }
        // Handle objects (JSON stringify)
        if (typeof value === 'object') {
            return `--${key}=${escapeValue(JSON.stringify(value))}`;
        }
        // Regular values
        return `--${key}=${escapeValue(value)}`;
    }).filter(Boolean).join(' ');
}
/**
 * Escapes values for command line usage
 */
function escapeValue(value) {
    const stringValue = String(value);
    // If value contains spaces, wrap in quotes
    if (stringValue.includes(' ')) {
        // Escape any existing quotes
        return `"${stringValue.replace(/"/g, '\\"')}"`;
    }
    return stringValue;
}
/**
 * Parses help text to extract structured information about commands or flags
 * @param helpText Help text from Salesforce CLI
 * @returns Structured information extracted from help text
 */
export function parseHelpText(helpText) {
    const description = [];
    const examples = [];
    const flags = {};
    // Split by sections
    const sections = helpText.split(/\n\s*\n/);
    // Extract description (usually the first section, skipping DESCRIPTION header if present)
    if (sections.length > 0) {
        let firstSection = sections[0].trim();
        if (firstSection.toUpperCase().startsWith('DESCRIPTION')) {
            firstSection = firstSection.substring(firstSection.indexOf('\n') + 1).trim();
        }
        description.push(firstSection);
    }
    // Look for a description section if the first section wasn't clear
    if (description[0]?.length < 10 || description[0]?.toUpperCase().includes('USAGE')) {
        const descSection = sections.find(section => section.toUpperCase().startsWith('DESCRIPTION') ||
            section.toUpperCase().includes('\nDESCRIPTION\n'));
        if (descSection) {
            const descContent = descSection.replace(/DESCRIPTION/i, '').trim();
            if (descContent) {
                description.push(descContent);
            }
        }
    }
    // Look for examples section with improved pattern matching
    const examplePatterns = [
        /EXAMPLES?/i,
        /USAGE/i
    ];
    for (const pattern of examplePatterns) {
        const exampleSection = sections.find(section => pattern.test(section));
        if (exampleSection) {
            // Extract examples - look for command lines that start with $ or sf
            const exampleLines = exampleSection.split('\n')
                .filter(line => {
                const trimmed = line.trim();
                return trimmed.startsWith('$') ||
                    trimmed.startsWith('sf ') ||
                    /^\s*\d+\.\s+sf\s+/.test(line); // Numbered examples: "1. sf ..."
            })
                .map(line => line.trim().replace(/^\d+\.\s+/, '')); // Remove numbering if present
            examples.push(...exampleLines);
        }
    }
    // Look for flags section with improved pattern matching
    const flagPatterns = [
        /FLAGS/i,
        /OPTIONS/i,
        /PARAMETERS/i,
        /ARGUMENTS/i
    ];
    for (const pattern of flagPatterns) {
        const flagSections = sections.filter(section => pattern.test(section));
        for (const flagSection of flagSections) {
            // Skip the section header line
            const sectionLines = flagSection.split('\n').slice(1);
            // Different patterns for flag lines
            const flagPatterns = [
                // Pattern 1: Classic -c, --char=<value> Description
                /^\s*(?:-([a-zA-Z]),\s+)?--([a-zA-Z][a-zA-Z0-9-]+)(?:=<?([a-zA-Z0-9_\-\[\]|]+)>?)?\s+(.+)$/,
                // Pattern 2: Indented flag with details (common in newer SF CLI)
                /^\s+(?:-([a-zA-Z]),\s+)?--([a-zA-Z][a-zA-Z0-9-]+)(?:\s+|\=)(?:<([a-zA-Z0-9_\-\[\]|]+)>)?\s*\n\s+(.+)/,
                // Pattern 3: Simple flag with no/minimal formatting
                /^\s*(?:-([a-zA-Z]),\s*)?--([a-zA-Z][a-zA-Z0-9-]+)(?:\s+|\=)?(?:\s*<([a-zA-Z0-9_\-\[\]|]+)>)?\s+(.+)$/
            ];
            // Process the flag section
            let i = 0;
            while (i < sectionLines.length) {
                const line = sectionLines[i];
                const nextLine = i < sectionLines.length - 1 ? sectionLines[i + 1] : '';
                const combinedLines = line + '\n' + nextLine;
                let matched = false;
                // Try all patterns
                for (const pattern of flagPatterns) {
                    const match = (line.match(pattern) || combinedLines.match(pattern));
                    if (match) {
                        matched = true;
                        const char = match[1];
                        const name = match[2];
                        const type = match[3] || 'boolean';
                        const description = match[4].trim();
                        // Check if this flag is required
                        const required = description.toLowerCase().includes('(required)') ||
                            description.toLowerCase().includes('[required]') ||
                            description.toLowerCase().includes('required:') ||
                            description.toLowerCase().includes('required -');
                        // Normalize the type
                        let normalizedType = type.toLowerCase();
                        if (normalizedType.includes('number') || normalizedType.includes('int')) {
                            normalizedType = 'number';
                        }
                        else if (normalizedType.includes('boolean') || normalizedType === 'flag') {
                            normalizedType = 'boolean';
                        }
                        else if (normalizedType.includes('array') || normalizedType.includes('[]')) {
                            normalizedType = 'array';
                        }
                        else if (normalizedType.includes('json') || normalizedType.includes('object')) {
                            normalizedType = 'json';
                        }
                        else {
                            normalizedType = 'string';
                        }
                        flags[name] = {
                            name,
                            char,
                            description: description.replace(/\([Rr]equired\)|\[[Rr]equired\]|[Rr]equired:?/g, '').trim(),
                            required,
                            type: normalizedType
                        };
                        // Skip the next line if we matched against a two-line pattern
                        if (combinedLines.match(pattern) && !line.match(pattern)) {
                            i++;
                        }
                        break;
                    }
                }
                // If no pattern matched and this line looks like it might be a flag
                if (!matched && (line.includes('--') || line.trim().startsWith('-'))) {
                    console.error(`No pattern matched for potential flag line: "${line.trim()}"`);
                }
                i++;
            }
        }
    }
    return {
        description: description.join('\n\n'),
        examples,
        flags
    };
}
