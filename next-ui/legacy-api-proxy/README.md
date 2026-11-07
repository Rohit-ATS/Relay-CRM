# Legacy Next API proxies

These route handlers are retained for reference but are intentionally outside `app/`.
The deployed frontend is a static GitHub Pages export and calls the FastAPI service
at `https://relay-crm-api.onrender.com` directly. GitHub Pages cannot execute Next
server route handlers.
