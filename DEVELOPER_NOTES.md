# ResolutionWikiDashboard Developer Notes

## Architecture Overview
The ResolutionWikiDashboard is a fork of TiddlyDesktop. We have completely rewritten the core navigation and project management logic to use a **Reference-Based Single Page Application (SPA)** architecture.

### Key Changes from TiddlyDesktop:
1. **Entry Point Shift**: TiddlyDesktop originally booted to `main.html` (which launched `WikiListWindow`). We still boot to `main.html` so that the `global.$tw` environment and saver plugins initialize properly. However, `main.js` now immediately opens `html/dashboard.html` as the primary user-facing window instead of the old WikiListWindow.
2. **Single Page Application (SPA)**: The Dashboard (`dashboard.js`) is an SPA. It toggles between the "Dashboard View" (Project List) and "Reports View" (Report List) using CSS `display:none`. This is critical because navigating via `window.location.href` inside NW.js would cause the window to lose the injected `window.$tw` variable, breaking the auto-save functionality.
3. **Reference-Based Storage**: Instead of physically creating folders and copying HTML files into them, the app now strictly stores absolute paths (references) to existing folders and files on your Mac.

## Configuration & Storage
All references are stored in a single JSON configuration file located at:
`~/.tiddlydesktop/dashboard-config.json`

**Schema:**
```json
{
  "projects": [
    {
      "id": "/absolute/path/to/project/folder",
      "name": "Display Name",
      "reports": [
        {
          "name": "report-name.html",
          "filePath": "/absolute/path/to/report-name.html"
        }
      ]
    }
  ]
}
```

### Services
- **`config.service.js`**: Handles reading and writing to `~/.tiddlydesktop/dashboard-config.json`. If the file doesn't exist, it bootstraps an empty `{ projects: [] }` state.
- **`project.service.js`**: Provides the CRUD API for the Dashboard UI. All functions (`addProject`, `removeProject`, `addReportToProject`, etc.) operate purely by mutating the JSON configuration array and saving it back to disk. No `fs.mkdirSync` or `fs.copyFileSync` operations are performed.

## TiddlyWiki Context (`$tw`) Integration
To ensure wikis can save themselves properly without prompting a "Save As" download, they must be opened through the native TiddlyDesktop `windowList` API.

**How it works:**
1. `main.js` boots up and creates the `global.$tw` object.
2. It opens `dashboard.html` and explicitly sets `win.window.$tw = $tw` (and also `win.window._twGlobal = global` as a fallback) once the DOM is loaded.
3. When you click "Open" on a report in `dashboard.js`, it calls:
   `window.$tw.desktop.windowList.openByPathname(w.filePath);`
   *(It includes fallback mechanisms to check `_twGlobal` or the background window via `nw.Window.get().window` just in case).*
4. Opening through this API registers the wiki window with TiddlyDesktop's backend, enabling the native filesystem saver interceptors.

## Known Gotchas
- **Window Lifecycle**: In the original TiddlyDesktop, closing the last open Wiki window would automatically shut down the background script (`this.backstageWindow_nwjs.close()`). Because our Dashboard does not register as a "Wiki window" to the internal engine, closing your only open report would previously kill the background app, breaking subsequent "Opens". This was fixed by removing the auto-close logic in `source/js/window-list.js`. The app lifecycle is now entirely controlled by whether the Dashboard window is open or closed.
