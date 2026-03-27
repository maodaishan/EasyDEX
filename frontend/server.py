#!/usr/bin/env python3
"""
Simple HTTP server for EasyDEX frontend
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

class EasyDEXHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def start_server(port=3000):
    """Start the development server"""
    
    # Change to frontend directory
    frontend_dir = Path(__file__).parent
    os.chdir(frontend_dir)
    
    try:
        with socketserver.TCPServer(("", port), EasyDEXHandler) as httpd:
            print(f"🚀 EasyDEX Frontend Server")
            print(f"📍 Running at: http://localhost:{port}")
            print(f"📁 Serving from: {frontend_dir}")
            print(f"🔗 Make sure Hardhat node is running on port 8545")
            print(f"\n🎯 Open your browser to http://localhost:{port}")
            print(f"Press Ctrl+C to stop the server\n")
            
            # Auto-open browser
            try:
                webbrowser.open(f'http://localhost:{port}')
            except:
                pass
                
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"❌ Port {port} is already in use")
            print(f"Try a different port: python server.py --port 3001")
        else:
            print(f"❌ Server error: {e}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='EasyDEX Frontend Server')
    parser.add_argument('--port', type=int, default=3000, help='Port to run server on')
    args = parser.parse_args()
    
    start_server(args.port)