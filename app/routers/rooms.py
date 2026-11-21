"""WebSocket protocol for room codes.

Client -> server:
  {"type": "create", "game": "petanque", "name": "Jack"}
  {"type": "join", "game": "petanque", "code": "ABCD", "name": "Sam"}
  {"type": "relay", "payload": {...}, "to": "<clientId>"}   (omit "to" = everyone else)
  {"type": "lock", "locked": true}                          (host only: stop new joins)

Server -> client: see app/serialize.py.
"""
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import config, serialize
from app.rooms import Member, Room, RoomError, RoomRegistry, cleanName, newClientId

router = APIRouter()
registry = RoomRegistry()


async def sendSafe(member: Member, message: dict) -> None:
    try:
        await member.socket.send_json(message)
    except Exception:
        # A dead socket is cleaned up by its own receive loop.
        pass


async def broadcast(room: Room, message: dict, exceptId: str | None = None) -> None:
    for member in list(room.members.values()):
        if member.clientId != exceptId:
            await sendSafe(member, message)


@router.websocket("/ws/rooms")
async def roomSocket(socket: WebSocket) -> None:
    await socket.accept()
    me = Member(clientId=newClientId(), name="Player", socket=socket)
    room: Room | None = None

    try:
        while True:
            raw = await socket.receive_text()
            if len(raw.encode("utf-8")) > config.maxMessageBytes:
                await sendSafe(me, serialize.error("tooLarge", "Message too large."))
                continue
            try:
                message = json.loads(raw)
                kind = message.get("type")
            except (ValueError, AttributeError):
                await sendSafe(me, serialize.error("badMessage", "Messages must be JSON objects."))
                continue

            try:
                if kind in ("create", "join"):
                    if room is not None:
                        raise RoomError("alreadyInRoom", "Leave your current room first.")
                    me.name = cleanName(message.get("name"))
                    game = str(message.get("game", ""))
                    if kind == "create":
                        room = registry.createRoom(game, me)
                    else:
                        room = registry.joinRoom(message.get("code"), game, me)
                        await broadcast(room, serialize.memberJoined(me), exceptId=me.clientId)
                    await sendSafe(me, serialize.joined(room, me.clientId))
                elif room is None:
                    raise RoomError("notInRoom", "Create or join a room first.")
                elif kind == "relay":
                    payload = message.get("payload")
                    if not isinstance(payload, dict):
                        raise RoomError("badMessage", "Relay payload must be an object.")
                    outgoing = serialize.relay(me.clientId, payload)
                    target = message.get("to")
                    if target:
                        if target in room.members:
                            await sendSafe(room.members[target], outgoing)
                    else:
                        await broadcast(room, outgoing, exceptId=me.clientId)
                elif kind == "lock":
                    if me.clientId != room.hostId:
                        raise RoomError("notHost", "Only the host can do that.")
                    room.locked = bool(message.get("locked", True))
                else:
                    raise RoomError("badMessage", f"Unknown message type: {kind}")
            except RoomError as problem:
                await sendSafe(me, serialize.error(problem.code, problem.message))
    except WebSocketDisconnect:
        pass
    finally:
        if room is not None:
            left, closed = registry.leave(room.code, me.clientId)
            if left is not None:
                if closed:
                    await broadcast(left, serialize.roomClosed("The host left the room."))
                else:
                    await broadcast(left, serialize.memberLeft(me.clientId))
