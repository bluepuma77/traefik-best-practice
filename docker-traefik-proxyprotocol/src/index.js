// index.js (ESM)
import fs from 'fs';
import net from 'net';
import tls from 'tls';
import { parseProxyProtocol } from './proxyprotocol.js';

// ---------------------------------------------------------------------
// Configuration:
const port = Number(process.env.PORT) || 3000;

// If you have certs for TLS, put them in ./certs/key.pem & ./certs/cert.pem.
// If they don't exist, TLS connections will fail to handshake.
const keyPath = './private-key.pem';
const certPath = './certificate.pem';

const haveTLSCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);
let secureContext = null;
if (haveTLSCerts) {
  secureContext = tls.createSecureContext({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  });
}

// ---------------------------------------------------------------------
// Utility to parse an HTTP request from a buffer if it contains \r\n\r\n
function parseHttpRequest(buffer) {
  const raw = buffer.toString('utf8');
  const headersEnd = raw.indexOf('\r\n\r\n');
  if (headersEnd === -1) {
    // No complete HTTP header yet
    return null;
  }
  // Separate the header part from any potential body
  const headerPart = raw.slice(0, headersEnd);
  const lines = headerPart.split('\r\n');

  const [requestLine, ...headerLines] = lines;
  const [method = '', path = '', version = ''] = requestLine.split(' ');

  const headers = {};
  for (const line of headerLines) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      headers[key] = val;
    }
  }

  return {
    http: {
      method,
      path,
      version,
    },
    headers,
    // rawLength is how many bytes total were in the headers portion
    rawLength: headersEnd + 4, // +4 for "\r\n\r\n"
  };
}

// ---------------------------------------------------------------------
// Construct the JSON echo response
function buildHttpResponse(proxyInfo, isTLS, http, headers, socket) {
  const responseData = {
    proxyProtocolVersion: proxyInfo?.version || 'none',
    connectionSourceIp: socket.remoteAddress,      // from raw or TLS socket
    proxyProtocolSourceIp: proxyInfo?.sourceIp || null,
    isTLS,
    http,
    httpHeaders: headers,
  };

  const json = JSON.stringify(responseData, null, 2);
  return (
    'HTTP/1.1 200 OK\r\n' +
    'Content-Type: application/json\r\n' +
    `Content-Length: ${Buffer.byteLength(json)}\r\n` +
    '\r\n' +
    json
  );
}

// ---------------------------------------------------------------------
// Handle plain HTTP requests
function handlePlainHttp(socket, initialBuffer, proxyInfo) {
  let buffer = initialBuffer;

  // Immediately check if the initial buffer already contains a full request
  maybeRespond();

  // If not complete, listen for further data
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    maybeRespond();
  });

  function maybeRespond() {
    const parsed = parseHttpRequest(buffer);
    if (parsed) {
      const { http, headers } = parsed;
      const response = buildHttpResponse(proxyInfo, false, http, headers, socket);
      socket.write(response);
      socket.end();
      // Once we respond, we don't parse further requests on the same connection
    }
  }
}

// ---------------------------------------------------------------------
// Handle TLS-wrapped HTTP requests
function handleTLSHttp(tlsSocket, initialBuffer, proxyInfo) {
  let buffer = initialBuffer;

  // Check if the initial buffer (post-handshake) has a full request
  maybeRespond();

  tlsSocket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    maybeRespond();
  });

  function maybeRespond() {
    const parsed = parseHttpRequest(buffer);
    if (parsed) {
      const { http, headers } = parsed;
      const response = buildHttpResponse(proxyInfo, true, http, headers, tlsSocket);
      tlsSocket.write(response);
      tlsSocket.end();
    }
  }
}

// ---------------------------------------------------------------------
// Main server: detect Proxy Protocol, then TLS vs. plain
function startServer() {
  const server = net.createServer((rawSocket) => {
    let buffer = Buffer.alloc(0);
    let proxyInfo = null;
    let protocolDetected = false;

    rawSocket.on('error', (err) => {
      console.error('Raw socket error:', err);
    });

    rawSocket.on('data', (chunk) => {
      // Accumulate data
      buffer = Buffer.concat([buffer, chunk]);

      if (!protocolDetected) {
        // 1) Attempt Proxy Protocol parse
        const ppResult = parseProxyProtocol(buffer);
        if (ppResult?.proxy) {
          proxyInfo = ppResult.proxy;
          buffer = buffer.slice(ppResult.bytesProcessed);
        }
        // If no valid PP, that's fine; we just continue

        // 2) Check if remainder looks like a TLS handshake
        // Typically: 0x16 (Handshake), 0x03 (TLS major), 0x01..0x03
        let isTLS = false;
        if (buffer.length >= 3) {
          if (buffer[0] === 0x16 && buffer[1] === 0x03) {
            isTLS = true;
          }
        }

        protocolDetected = true;

        // Switch to TLS or stay plain
        if (isTLS && secureContext) {
          // Wrap raw socket in a TLSSocket
          const tlsSocket = new tls.TLSSocket(rawSocket, {
            isServer: true,
            secureContext,
          });

          // Immediately feed any data we've already read to the TLS engine
          // (internal approach)
          tlsSocket._handle?.receive(buffer);

          // Remove all listeners from raw socket so we don't double-consume data
          rawSocket.removeAllListeners('data');

          tlsSocket.on('error', (err) => {
            console.error('TLS socket error:', err);
          });

          // Once TLS handshake completes:
          tlsSocket.on('secure', () => {
            // Now handle the actual HTTP
            handleTLSHttp(tlsSocket, Buffer.alloc(0), proxyInfo);
          });
        } else {
          // Plain HTTP
          rawSocket.removeAllListeners('data');
          handlePlainHttp(rawSocket, buffer, proxyInfo);
        }
      }
      // If protocol already detected, do nothing here
    });
  });

  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`TLS certs found: ${haveTLSCerts ? 'Yes' : 'No'}`);
  });
}

startServer();
