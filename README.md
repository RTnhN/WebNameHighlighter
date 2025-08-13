# Web Name Highlighter

Chrome extension that highlights names and keywords on web pages.

## Features
- Organize names into custom groups.
- Add, edit, or delete names within each group.
- Maintain an editable list of keywords.
- Automatically generates name variants (e.g. `j smith`, `j. smith`, `john smith`, `smith, j`, `smith, john`).
- Highlights all occurrences on the current page.
- Hovering a highlighted name displays its group name.
- Choose highlight colors for last name, full name, and keyword matches.
- Import names and their groups from a CSV file.

## Usage
1. Load the extension in Chrome via `chrome://extensions` → **Load unpacked** and select this folder.
2. Click the extension icon to open the popup.
3. Create groups and add names or keywords in the popup, then click the corresponding **Save** buttons.
   You can also import names via CSV using the **Name Groups** upload control (format: `group,first,last`).
4. The active page will highlight matching names and keywords.
