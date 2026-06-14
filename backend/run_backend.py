"""PyInstaller entry point for the desktop backend."""
import asyncio
from agent.server import main

asyncio.run(main())
