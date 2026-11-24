# Production deployment

The web app is a static Angular build served by Nginx. Deploy it independently from the API and native mobile app.

Build an immutable image:

    docker build -t registry.example/simplia/web:1.0.0 .

The container listens on port 8080 and provides /health. Set API_UPSTREAM to the internal API URL with a trailing slash, such as http://simpliadz-api:8080/. Browsers call /api, while Nginx proxies that path to the API.

Use this image behind a TLS reverse proxy on a VM/on-premises installation or container service. Publish versioned tags, never latest, and keep web/API versions compatible. Cache hashed assets aggressively but keep index.html and config/app-config.json short-lived.
