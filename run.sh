#!/bin/bash

# Check if sf command is available
if ! command -v sf &> /dev/null; then
    echo "Error: Salesforce CLI (sf) is not installed or not in your PATH"
    echo "Please install it from: https://developer.salesforce.com/tools/sfdxcli"
    exit 1
fi

# Print current directory and sf version
echo "Current directory: $(pwd)"
echo "Salesforce CLI version:"
sf --version

# Build and run the server
echo "Building and starting MCP server..."
npm run build
node build/index.js