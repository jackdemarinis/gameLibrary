"""Every message the server sends is built here."""
from app.rooms import Member, Room


def member(item: Member) -> dict:
    return {"clientId": item.clientId, "name": item.name}


def joined(room: Room, clientId: str) -> dict:
    return {
        "type": "joined",
        "code": room.code,
        "game": room.game,
        "clientId": clientId,
        "hostId": room.hostId,
        "members": [member(item) for item in room.members.values()],
    }


def memberJoined(item: Member) -> dict:
    return {"type": "memberJoined", "member": member(item)}


def memberLeft(clientId: str) -> dict:
    return {"type": "memberLeft", "clientId": clientId}


def roomClosed(reason: str) -> dict:
    return {"type": "roomClosed", "reason": reason}


def relay(fromId: str, payload: dict) -> dict:
    return {"type": "relay", "from": fromId, "payload": payload}


def error(code: str, message: str) -> dict:
    return {"type": "error", "error": {"code": code, "message": message}}
