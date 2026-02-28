# 🎵 MasterSheet — Live Music Sheet Viewer

A lightweight, real-time music sheet (PDF) viewer built for live band performances. Runs on a Raspberry Pi with Google Mesh WiFi, letting every band member view the same sheet music with synchronized page turns and hand-drawn annotations.

## Features

- **PDF Viewer** — Render music sheets with `pdfjs-dist`, page-by-page navigation
- **Real-time Sync** — Song selection and page turns broadcast to all connected devices via Socket.io
- **Hand-draw Annotations** — Draw notes, cues, dynamics on the sheet; strokes sync to all members live
- **Setlist Management** — Calendar-based setlists, multiple per date, pre-build for gigs
- **Song Library** — Upload/manage PDFs via drag-and-drop; stored in SQLite
- **Persistent Annotations** — Save annotations per song/page; load them next rehearsal
- **Singer View** — Fullscreen touch-friendly viewer with swipe gestures for performers
- **Keyboard Shortcuts** — Arrow keys for page turns, `D` to toggle draw mode, `E` for eraser
- **Offline-capable** — Runs entirely on local network, no internet needed
- **Touch Support** — Draw with finger on tablets/phones, screen locks during drawing

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Raspberry Pi                       │
│                                                     │
│  ┌──────────────┐    ┌────────────────────────────┐ │
│  │   SQLite DB   │    │     Express + Socket.io   │ │
│  │  (songs,      │◄──►│     Server (port 4000)    │ │
│  │   setlists,   │    │                            │ │
│  │   annotations)│    │  Serves React build +      │ │
│  └──────────────┘    │  PDF uploads + WebSocket   │ │
│                       └─────────┬──────────────────┘ │
│                                 │                    │
└─────────────────────────────────┼────────────────────┘
                                  │  Google Mesh WiFi
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
      ┌─────▼─────┐     ┌────────▼────┐     ┌─────────▼───┐
      │  Tablet 1  │     │  Tablet 2   │     │  Laptop 3   │
      │  (Guitar)  │     │  (Drums)    │     │  (Keys)     │
      │  Browser   │     │  Browser    │     │  Browser    │
      └───────────┘     └─────────────┘     └─────────────┘
```

## Quick Start (Development)

```bash
# 1. Install everything
npm run setup

# 2. Start the backend
npm run dev:server

# 3. In another terminal, start the frontend
npm run dev:client

# Open http://localhost:3000
```

## Deploy to Raspberry Pi

```bash
# Copy project to Pi (e.g. via scp, USB, or git clone)
scp -r . pi@<pi-ip>:~/mastersheet

# SSH into the Pi
ssh pi@<pi-ip>

# Run the setup script
cd ~/mastersheet
chmod +x setup-pi.sh
./setup-pi.sh
```

The script will:
1. Install Node.js and build tools
2. Install npm dependencies
3. Build the React client
4. Create a systemd service running on port 80
5. Start automatically on boot

Access from any device on the mesh: **http://\<pi-ip\>**

## Usage

### Song Management
1. **Upload** — Drag & drop PDFs into the sidebar upload zone
2. **Browse** — Click any song to load it; all devices sync automatically
3. **Delete** — Hover over a song and click ×

### Setlists
1. Switch to the **Setlists** tab in the sidebar
2. Pick a date on the calendar
3. Create a new setlist for that date
4. Search and add songs from your library
5. Click a setlist to load it; click songs within to navigate

### Annotations
1. Press **D** or click the ✏️ button to enter draw mode
2. Choose a color and stroke width from the toolbar
3. Draw on the sheet — strokes appear on all connected devices in real-time
4. Press **E** or click the 🧹 button for eraser mode
5. Click 💾 **Save** to persist annotations (they load automatically next time)
6. Click 🗑 **Clear** to wipe annotations for the current page

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `→` / `↓` | Next page |
| `←` / `↑` | Previous page |
| `D` | Toggle draw mode |
| `E` | Toggle eraser mode |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| PDF Rendering | pdfjs-dist |
| Real-time Sync | Socket.io |
| Backend | Express.js |
| Database | SQLite (better-sqlite3, WAL mode) |
| Hardware | Raspberry Pi + Google Mesh WiFi |

## Project Structure

```
mastersheet/
├── server/
│   ├── index.js          # Express + Socket.io server
│   ├── db.js             # SQLite setup & migrations
│   ├── routes.js         # REST API (songs, setlists, annotations)
│   └── socket.js         # WebSocket event handlers
├── client/
│   ├── src/
│   │   ├── App.jsx       # Root component
│   │   ├── api.js        # HTTP client
│   │   ├── hooks/
│   │   │   └── useSocket.js
│   │   ├── components/
│   │   │   ├── Viewer.jsx          # PDF viewer + toolbar
│   │   │   ├── PdfCanvas.js        # PDF rendering hook
│   │   │   ├── AnnotationCanvas.jsx # Drawing overlay
│   │   │   ├── Sidebar.jsx         # Song list + setlists + upload
│   │   │   ├── Calendar.jsx        # Calendar component
│   │   │   ├── HomePage.jsx        # Landing page
│   │   │   └── SingerView.jsx      # Fullscreen singer viewer
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   └── vite.config.js
├── setup-pi.sh           # Raspberry Pi deployment script
├── package.json
└── README.md
```

## Network Tips for Google Mesh

- The Pi should be connected to the mesh via Ethernet for reliability
- All band members connect their tablets/phones to the same mesh WiFi
- The Pi's IP is typically static once assigned by the mesh router
- You can set a static IP in `/etc/dhcpcd.conf` on the Pi:
  ```
  interface eth0
  static ip_address=192.168.86.100/24
  static routers=192.168.86.1
  static domain_name_servers=192.168.86.1
  ```

## License

MIT
