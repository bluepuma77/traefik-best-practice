# docker-traefik-proxyprotocol

Example of using ProxyProtocol between Traefik and target service.

Traefik will proxy/forward all (encrypted) TLS traffic on `entrypoints` 8000, 8001, 8002 untouched to a target service. Port 8000 uses no proxy protocol, port 8001 uses proxy protocol v1 and port 802 uses proxy protocol v2 to target.

The target service is a simple NodeJS echo service showing the headers and optional proxy protocol and optional TLS. It will use a simple custom TLS certificate, which can be created with
```
openssl req -x509 -newkey rsa:4096 -keyout private-key.pem -out certificate.pem -days 365 -nodes
```

Then you can use something like `curl -k https://echo.example.com:<port>` for requests to the target service with end-to-end TLS encryption, without Traefik having access to the TLS certs. Of course this limits to one target service per port.

## Deployment:
- Adapt all domain names in `Host()`
- Adapt `acme.email`
- Adapt dashboard username/password
- For production: write logs files to mounted folder on host
- Run `docker compose -p proxyprotocol up -d --build --force-recreate`
- For logs `docker compose -p proxyprotocol logs -f`

## Little NodeJS echo service
- accepts http request with and without proxy protocol (v1/v2)
- accepts http request with and without TLS encryption
- responds with connection information and echos http headers:
```
{
  "proxyProtocolVersion": "v2",
  "connectionSourceIp": "::ffff:172.19.0.2",
  "proxyProtocolSourceIp": "8.7.6.5",
  "isTLS": true,
  "http": {
    "method": "GET",
    "path": "/",
    "version": "HTTP/1.1"
  },
  "httpHeaders": {
    "host": "echo.example.com:8002",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Gecko/20100101 Firefox/134.0",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-encoding": "gzip, deflate, br, zstd",
    ...
  }
}
```

