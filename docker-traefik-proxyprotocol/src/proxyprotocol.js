// proxyprotocol.js (ESM)

export function parseProxyProtocol(buffer) {
  // 1) Try Proxy Protocol v1 (starts with "PROXY ")
  const text = buffer.toString('ascii', 0, Math.min(buffer.length, 108));
  if (text.startsWith('PROXY ')) {
    const lineEnd = text.indexOf('\r\n');
    if (lineEnd === -1) {
      return { error: 'Incomplete Proxy Protocol v1 header' };
    }
    const line = text.substring(0, lineEnd); // e.g. "PROXY TCP4 1.2.3.4 5.6.7.8 12345 80"
    const parts = line.split(' ');
    if (parts.length >= 6) {
      return {
        proxy: {
          version: 'v1',
          protocol: parts[1],       // e.g. "TCP4", "TCP6"
          sourceIp: parts[2],
          destinationIp: parts[3],
          sourcePort: parts[4],
          destinationPort: parts[5],
        },
        bytesProcessed: lineEnd + 2, // +2 for "\r\n"
      };
    }
    return { error: 'Malformed Proxy Protocol v1 header' };
  }

  // 2) Try Proxy Protocol v2
  // Signature bytes: 0D 0A 0D 0A 00 0D 0A 51 55 49 54 0A
  if (buffer.length >= 16) {
    const sig = buffer.slice(0, 12).toString('hex');
    const v2sig = '0d0a0d0a000d0a515549540a';
    if (sig === v2sig) {
      const verCmd = buffer[12];
      const version = verCmd >> 4; // High 4 bits => version
      if (version !== 2) {
        return { error: 'Invalid Proxy Protocol v2 header (version != 2)' };
      }

      // Byte 13 => family & protocol
      const familyByte = buffer[13];
      // Byte 14..15 => length of remaining header data
      const len = buffer.readUInt16BE(14);
      const totalV2HeaderLen = 16 + len;
      if (buffer.length < totalV2HeaderLen) {
        return { error: 'Incomplete Proxy Protocol v2 header' };
      }

      // The upper 4 bits = address family; the lower 4 bits = transport protocol
      //  0x1x => AF_INET  (IPv4)
      //  0x2x => AF_INET6 (IPv6)
      //  0x0x => AF_UNSPEC
      //  plus the lower bits: 1 => STREAM (TCP), 2 => DGRAM (UDP), etc.
      const addressFamily = (familyByte & 0xf0) >> 4; // top nibble
      const transportProto = familyByte & 0x0f;       // bottom nibble

      let sourceIp = null;
      let destinationIp = null;
      let sourcePort = null;
      let destinationPort = null;

      // The address block starts at offset 16
      // For IPv4 + TCP/UDP:  4 bytes src IP, 4 bytes dst IP, 2 bytes src port, 2 bytes dst port (total 12)
      // For IPv6 + TCP/UDP: 16 bytes src IP,16 bytes dst IP, 2 bytes src port, 2 bytes dst port (total 36)
      let offset = 16;

      if (addressFamily === 0x1) {
        // IPv4
        if (len >= 12) {
          // 4 bytes src IP
          const srcBuf = buffer.slice(offset, offset + 4);
          offset += 4;
          // 4 bytes dst IP
          const dstBuf = buffer.slice(offset, offset + 4);
          offset += 4;
          // 2 bytes src port
          sourcePort = buffer.readUInt16BE(offset);
          offset += 2;
          // 2 bytes dst port
          destinationPort = buffer.readUInt16BE(offset);
          offset += 2;

          sourceIp = srcBuf.join('.');
          destinationIp = dstBuf.join('.');
        }
      } else if (addressFamily === 0x2) {
        // IPv6
        if (len >= 36) {
          // 16 bytes src IP
          const srcBuf = buffer.slice(offset, offset + 16);
          offset += 16;
          // 16 bytes dst IP
          const dstBuf = buffer.slice(offset, offset + 16);
          offset += 16;
          // 2 bytes src port
          sourcePort = buffer.readUInt16BE(offset);
          offset += 2;
          // 2 bytes dst port
          destinationPort = buffer.readUInt16BE(offset + 2);

          // Convert buffer to IPv6 string
          sourceIp = bufToIPv6(srcBuf);
          destinationIp = bufToIPv6(dstBuf);
        }
      } else {
        // Family was 0x0 (UNSPEC) or 0x4 (AF_UNIX), etc.
        // We won't parse addresses here.
        // In that case, the official spec says no address information is carried.
      }

      return {
        proxy: {
          version: 'v2',
          sourceIp,
          destinationIp,
          sourcePort,
          destinationPort,
          family: addressFamily,      // 1 => IPv4, 2 => IPv6
          protocol: transportProto,   // 1 => TCP, 2 => UDP, ...
        },
        bytesProcessed: totalV2HeaderLen,
      };
    }
  }

  // If none recognized
  return { error: 'No Proxy Protocol header' };
}

// Helper function to convert a 16-byte IPv6 buffer into a readable string
function bufToIPv6(buf) {
  // Split into eight 16-bit words
  const parts = [];
  for (let i = 0; i < 16; i += 2) {
    parts.push(buf.readUInt16BE(i).toString(16));
  }
  // Then compress the longest run of zeros
  const ipv6Str = parts.join(':')
    .replace(/(^|:)0+([0-9a-f])/g, '$1$2')  // remove leading zeros in each group
    .replace(/(:0+)+:/, '::');             // collapse multiple groups of zeros
  return ipv6Str;
}
