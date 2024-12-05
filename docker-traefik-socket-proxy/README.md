# docker-traefik-socket-proxy

Simple `docker-compose.yml` template to run Traefik with a Docker socket proxy and a whoami service with Docker.

## Features:
- Use nginx as docker-socket-proxy, only allowing relevant GET requests to Docker socket
- Traefik is listening on ports 80 (http) and 443 (https)
- All http requests will be redirected to secure https requests
- Docker services with label `traefik.enable=true` will automatically be discovered by Traefik
- Letsencrypt will automatically generate TLS/SSL certificates for all domains in `Host()`
- Traefik log (`level=INFO`) and access log are enabled to container stdout/stderr
- Traefik dashboard is enabled at `https://traefik.example.com/dashboard/` with user/pass test/test

## Deployment:

- Adapt all domain names in `Host()`
- Adapt `acme.email`
- Adapt dashboard username/password
- For production: write logs files to mounted folder on host
- Run `docker compose up -d`

## Problems:

- When using Traefik v2, remove line `entrypoints.websecure.asDefault=true`
