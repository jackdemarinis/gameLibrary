"""In-memory game rooms. Game-agnostic: the host's browser runs the game and
this registry only tracks who is in which room."""
from __future__ import annotations

import random
import secrets
from dataclasses import dataclass, field
from typing import Any

from app import config


class RoomError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class Member:
    clientId: str
    name: str
    socket: Any = None


@dataclass
class Room:
    code: str
    game: str
    hostId: str
    members: dict[str, Member] = field(default_factory=dict)
    locked: bool = False


def cleanName(rawName: Any) -> str:
    name = " ".join(str(rawName or "").split())[: config.maxNameLength]
    return name or "Player"


def newClientId() -> str:
    return secrets.token_hex(6)


class RoomRegistry:
    def __init__(self, rng: random.Random | None = None):
        self.rooms: dict[str, Room] = {}
        self.rng = rng or random.SystemRandom()

    def _newCode(self) -> str:
        for _ in range(200):
            code = "".join(self.rng.choice(config.roomCodeAlphabet) for _ in range(config.roomCodeLength))
            if code not in self.rooms:
                return code
        raise RoomError("roomsFull", "No room codes left. Try again shortly.")

    def createRoom(self, game: str, member: Member) -> Room:
        if game not in config.knownGames:
            raise RoomError("unknownGame", "That game doesn't support online play.")
        if len(self.rooms) >= config.maxRooms:
            raise RoomError("roomsFull", "The server is full. Try again shortly.")
        room = Room(code=self._newCode(), game=game, hostId=member.clientId)
        room.members[member.clientId] = member
        self.rooms[room.code] = room
        return room

    def joinRoom(self, code: str, game: str, member: Member) -> Room:
        room = self.rooms.get(str(code or "").strip().upper())
        if room is None or room.game != game:
            raise RoomError("roomNotFound", "No room with that code.")
        if room.locked:
            raise RoomError("roomLocked", "That match has already started.")
        if len(room.members) >= config.maxRoomMembers:
            raise RoomError("roomFull", "That room is full.")
        room.members[member.clientId] = member
        return room

    def leave(self, code: str, clientId: str) -> tuple[Room | None, bool]:
        """Removes a member. Returns (room, closed); the room closes when the host leaves."""
        room = self.rooms.get(code)
        if room is None or clientId not in room.members:
            return None, False
        del room.members[clientId]
        if clientId == room.hostId or not room.members:
            del self.rooms[code]
            return room, True
        return room, False
