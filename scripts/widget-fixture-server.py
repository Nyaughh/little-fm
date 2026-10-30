"""Local HTTP image fixture for the Android emulator, independent of public DNS."""
from http.server import BaseHTTPRequestHandler, HTTPServer
import random
import struct
import zlib

def chunk(kind, value):
    return struct.pack('>I', len(value)) + kind + value + struct.pack('>I', zlib.crc32(kind + value))

rng = random.Random(1729)
pixels = b''.join(b'\0' + rng.randbytes(300 * 3) for _ in range(300))
cover = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 300, 300, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b'')
assert len(cover) > 64000

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/cover.png':
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', 'image/png')
        self.send_header('Content-Length', str(len(cover)))
        self.end_headers()
        self.wfile.write(cover)

HTTPServer(('127.0.0.1', 8788), Handler).serve_forever()
