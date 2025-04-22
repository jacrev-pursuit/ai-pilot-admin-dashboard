#!/bin/zsh

# Navigate to the script's directory to ensure correct relative paths
cd "$(dirname "$0")"

# Get yesterday's date in YYYY-MM-DD format (macOS compatible)
YESTERDAY=$(date -v-1d '+%Y-%m-%d')

# Define the path to the Node script
NODE_SCRIPT="server/analyze-feedback-sentiment.js"

# Define the path to the Node executable
NODE_EXEC="/usr/local/bin/node"

# Define log file path (optional, adjust as needed)
LOG_DIR="logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/feedback-analysis-$(date '+%Y-%m-%d').log"

# Execute the Node script with yesterday's date, redirecting output to log file
$NODE_EXEC "$NODE_SCRIPT" "$YESTERDAY" >> "$LOG_FILE" 2>&1

echo "Feedback analysis script executed for $YESTERDAY at $(date)" >> "$LOG_FILE"

exit 0 