Open the Task Trellis browser UI by doing the following:

1. Call the `get_ui_info` MCP tool (tool name: `get_ui_info`, from the task-trellis MCP server). If the call fails or the tool is not available, stop and tell the user: "The Task Trellis UI could not be opened because the get_ui_info tool is unavailable. Make sure the task-trellis-mcp server is running and the get_ui_info tool is registered."

2. From the result, pick the URL to open:
   - Use `projectUrl` if it is present and non-empty.
   - Otherwise fall back to `url`.

3. Open the chosen URL using the platform-appropriate command via Bash:
   - macOS (Darwin): `open <url>`
   - Linux: `xdg-open <url>`
   - Windows: `start <url>`

   Detect the platform from the `uname` output or `$OSTYPE`. If the platform cannot be determined, default to `open`.

4. Confirm to the user which URL was opened.
