# docker-traefik-tcp

Simple `docker-compose.yml` template to run Traefik in Docker with TCP routers. 

Port 443 is TCP-router enabled, it will use LetsEncrypt to create a cert for `HostSNI()`, you can connect to it via TLS, for example using `openssl s_client -connect tcp.example.com:443`. With this multiple (sub-)domains can be used, Traefik managing TLS and forwarding data stream un-encrypted.

Port 9000 is TCP-router enabled, just for plain TCP. Traefik can not see anything inside that connection, so only HostSNI(`*`) can be used for a single service. If you enable any TLS on the router, then Traefik will create a default cert, unless you load a custom TLS cert via `provider.file`. The target service can use plain TCP or create it's own custom TLS cert. Note that LetsEncrypt with httpChallenge and tlsChallenge only works with ports 80/443, so if the service wants to create a LE cert, it needs to use dnsChallenge.

## Features:

- Traefik is listening on ports 80 (http), 443 (https) and 9000 (plain TCP)
- All http requests will be redirected to secure https requests
- Docker services with label `traefik.enable=true` will automatically be discovered by Traefik
- Letsencrypt will automatically generate TLS/SSL certificates for all domains in `Host()` and `HostSNI()`
- Traefik log (`level=INFO`) and access log are enabled to container stdout/stderr
- Traefik dashboard is enabled at `https://traefik.example.com/dashboard/` with user/pass test/test
- Example whoami router will automatically redirect from "www.whoami.example.com" to "whoami.example.com"

## Deployment:

- Adapt all domain names in `Host()` and `HostSNI()`
- Adapt `acme.email`
- Adapt dashboard username/password
- For production: write logs files to mounted folder on host
- Run `docker compose up -d`

## Notes:

- `websecure` entrypoint has LetsEncrypt for http(s), but the TCP router needs an additional LE assignment

