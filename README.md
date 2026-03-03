# TaskAgent: Agentic Task Manager with Voice UI

TaskAgent is a voice-first, Progressive Web App (PWA) that turns your
spoken words into actionable to-dos. It runs entirely in the browser
(no build step or server required) and is optimized for offline use and
OLED displays.

## 📚 Table of Contents

1. [Features](#-features)
2. [Tech Stack](#-tech-stack)
3. [Getting Started](#-getting-started)
   1. [Prerequisites](#prerequisites)
   2. [Installation](#installation)
   3. [Usage](#usage)
4. [Development](#development)
5. [Deployment](#deployment)
6. [Contributing](#contributing)
7. [License](#license)

---

## 🌟 Features

- **Voice Commands** – Add, delete, or complete tasks using natural
  language: "Remember to buy milk" or "Add high priority task: Finish
  report."  
- **Intent Parsing** – Detects keywords (`urgent`, `tomorrow`,
  `high priority`) and updates task metadata.
- **Auditory Feedback** – Confirms actions via speech synthesis.  
- **Offline‑First PWA** – Service worker enables full functionality
  without network connectivity.  
- **OLED‑Friendly Dark Theme** – True‑black backgrounds for battery
  savings.  
- **Kinetic Typography** – CSS animations visualize listening,
  thinking, and success states.


## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| UI     | HTML5, CSS3 (custom properties, motion UI) |
| Logic  | Vanilla JavaScript (zero external deps) |
| Voice  | Web Speech API (recognition + synthesis) |
| Offline| Service Worker (`sw.js`) |
| PWA    | `manifest.json` |


## 🚀 Getting Started

### Prerequisites

- A modern browser with Web Speech API support (Chrome, Edge).
- No server, build tools, or package managers required.

### Installation

```bash
git clone https://github.com/<your‑username>/agentic-task-manager.git
cd agentic-task-manager
```

### Usage

1. **Serve the files**
   - Open `index.html` directly for basic UI (voice works but PWA
     features are disabled).
   - For full PWA/testing, run any static HTTP server (see
     [Development](#development)).
2. **Interact**
   - Click/tap the microphone icon.
   - Say a task or command (e.g. "Add high priority task: Finish
     report").
   - The app will speak a confirmation and show the task in the list.
   - Manage tasks via touch/click or voice commands like "delete task."


## �️ Development

The project is static and requires no build tools or package managers. To serve the files locally:
- **GitHub Pages** – push the repo and enable Pages; HTTPS is provided.
- **PowerShell server** (Windows only):
  ```powershell
  Add-Type -AssemblyName System.Net.HttpListener
  $listener = [System.Net.HttpListener]::new()
  $listener.Prefixes.Add('http://*:8000/')
  $listener.Start()
  while ($listener.IsListening) {
      $ctx = $listener.GetContext(); $req = $ctx.Request
      $path = $req.Url.LocalPath.TrimStart('/') -replace '/','\'
      $file = Join-Path (Get-Location) $path
      if (-not (Test-Path $file)) { $file = Join-Path (Get-Location) 'index.html' }
      $bytes = [IO.File]::ReadAllBytes($file)
      $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
      $ctx.Response.Close()
  }
  ```
  Then browse to `http://localhost:8000` on desktop or mobile.

- **Alternative** – use any simple static server (e.g. `npx http-server`
  if you later install Node).


## 📦 Deployment

To publish the app, simply serve the `agentic-task-manager` directory from
any static host:

- **GitHub Pages** – preferred for quick demos.  
- **Netlify / Vercel / Firebase Hosting** – drag‑and‑drop or connect the
  repo.

> ⚠️ The site **must** be served over HTTPS (or `localhost`) for the
service worker and install prompt to operate.

After deployment, open the URL in Chrome and choose _Add to Home screen_
if desired.


## 🤝 Contributing

To contribute:

1. Fork the repository.  
2. Create a feature or bugfix branch.  
3. Open a pull request with details of your changes.

Please ensure your code follows the existing style and test any voice
input manually.  

This project is released under the MIT License – see `LICENSE`.


## 📝 License

This project is available under the [MIT License](LICENSE).

---
