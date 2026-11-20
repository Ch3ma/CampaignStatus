import { crc32, deflateSync } from 'node:zlib';

function chunk(name, contents) {
  const data = Buffer.concat([Buffer.from(name, 'ascii'), contents]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(contents.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(data));
  return Buffer.concat([size, data, checksum]);
}

// Fictional telemetry generated solely for the emulator demo.
export function demoImage() {
  const width = 640;
  const height = 400;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header.set([8, 2], 8);

  const stride = width * 3 + 1;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - width / 2;
      const dy = y - height / 2;
      const distance = Math.hypot(dx, dy);
      const grid = (x % 40 === 0 || y % 40 === 0) ? 12 : 0;
      const ring = distance < 165 && Math.round(distance) % 40 === 0 ? 55 : 0;
      const trace = Math.abs(dy - Math.sin(dx / 35) * Math.cos(dx / 70) * 32) < 2 ? 100 : 0;
      const glow = Math.max(0, 38 - distance / 7);
      pixels.set([10 + ring + trace, 20 + grid + ring + trace + glow, 17 + ring + trace / 2],
        y * stride + x * 3 + 1);
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
