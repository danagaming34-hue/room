# Rooms Chat

A tiny room-based chat app. People who enter the same room number join the same live room.

## Features

- Room numbers for joining from multiple devices
- Live updates with Server-Sent Events
- Text, clickable links, pasted images, dropped files, and file uploads
- Message edit, copy, cut, and delete actions
- Local message persistence in `data/rooms.json`

## Run Locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Other devices on the same Wi-Fi can use your computer's LAN URL, for example:

```text
http://192.168.100.87:3000
```

## GitHub Hosting Note

GitHub Pages hosts static HTML, CSS, and JavaScript. This app needs `server.js` running for real-time rooms, so the full chat cannot run only on GitHub Pages. Push this repo to GitHub for source hosting, then deploy it to a Node host such as Render, Railway, Fly.io, Azure App Service, or a VPS.

## Deploy on Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/danagaming34-hue/room)

This repo includes `render.yaml`, so Render can create the Node web service from the repository.

Recommended settings if creating the service manually:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

Render provides `PORT` automatically, and the server uses it.
