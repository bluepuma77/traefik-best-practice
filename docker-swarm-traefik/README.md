# docker-swarm-traefik

Simple `docker-compose.yml` template to run Traefik and a whoami service with Docker Swarm.

## Features:

- Traefik will be deployed to all manager nodes (to have access to Swarm docker.sock)
- Traefik is listening on ports 80 (http) and 443 (https) on the node itself
- All http requests will be redirected to secure https requests
- Docker services with label `traefik.enable=true` will automatically be discovered by Traefik
- Letsencrypt will automatically generate TLS/SSL certificates for all domains in `Host()`
- Traefik log (`level=INFO`) and access log are enabled to container stdout/stderr
- Traefik dashboard is enabled at `https://traefik.example.com/dashboard/` with user/pass test/test
- Traefik `whoami` will be deployed to all Swarm nodes, available at `https://whoami.example.com`

## Deployment:

- Adapt all domain names in `Host()`
- Adapt `acme.email`
- Adapt dashboard username/password
- For production: write logs files to mounted folder on host
- Run `docker stack deploy -c docker-compose.yml proxy`

## Challenges:

- Only a single Traefik instance should be run for `httpChallenge` or `tlsChallenge` to work, as Traefik CE (community edition) is not cluster-enabled. If you need clustered LetsEncrypt TLS, use `dnsChallenge` or a different method to generate the certs.
- Make sure to persist the LetsEncrypt TLS certs, as LetsEncrypt has strict limits. Note that the content of volumes is not shared across nodes.
