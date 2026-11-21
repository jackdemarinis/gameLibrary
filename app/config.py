"""Settings from environment variables. The only module that reads os.environ."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

repoRoot = Path(__file__).resolve().parent.parent

staticDir = (repoRoot / os.getenv("STATIC_DIR", "dist")).resolve()
maxRoomMembers = int(os.getenv("MAX_ROOM_MEMBERS", "4"))
maxRooms = int(os.getenv("MAX_ROOMS", "500"))
maxMessageBytes = int(os.getenv("MAX_MESSAGE_BYTES", "16384"))

roomCodeLength = 4
# No I, O, 0 or 1: codes get read aloud over voice chat.
roomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ"
maxNameLength = 16
knownGames = {"petanque"}
