"""Run with .venv/bin/python -m unittest discover -s tests -v."""
import unittest

from fastapi.testclient import TestClient

from app.main import createApp
from app.routers import rooms


class RoomSocketTests(unittest.TestCase):
    def setUp(self):
        rooms.registry.rooms.clear()
        self.client = TestClient(createApp())

    def connect(self):
        return self.client.websocket_connect("/ws/rooms")

    def testHostCreatesAndGuestJoinsWithCode(self):
        with self.connect() as host, self.connect() as guest:
            host.send_json({"type": "create", "game": "petanque", "name": "  Jack  "})
            created = host.receive_json()
            self.assertEqual(created["type"], "joined")
            self.assertEqual(len(created["code"]), 4)
            self.assertEqual(created["hostId"], created["clientId"])
            self.assertEqual(created["members"][0]["name"], "Jack")

            guest.send_json({"type": "join", "game": "petanque", "code": created["code"].lower(), "name": "Sam"})
            joined = guest.receive_json()
            self.assertEqual(joined["hostId"], created["clientId"])
            self.assertEqual([member["name"] for member in joined["members"]], ["Jack", "Sam"])
            self.assertEqual(host.receive_json()["type"], "memberJoined")

    def testRelayBroadcastsAndTargets(self):
        with self.connect() as host, self.connect() as guest:
            host.send_json({"type": "create", "game": "petanque", "name": "Jack"})
            code = host.receive_json()["code"]
            guest.send_json({"type": "join", "game": "petanque", "code": code, "name": "Sam"})
            guestId = guest.receive_json()["clientId"]
            host.receive_json()

            guest.send_json({"type": "relay", "payload": {"kind": "aim", "angle": 0.1}})
            relayed = host.receive_json()
            self.assertEqual(relayed, {"type": "relay", "from": guestId, "payload": {"kind": "aim", "angle": 0.1}})

            host.send_json({"type": "relay", "to": guestId, "payload": {"kind": "state"}})
            self.assertEqual(guest.receive_json()["payload"], {"kind": "state"})

    def testUnknownCodeAndLockedRoomAreRejected(self):
        with self.connect() as host, self.connect() as guest:
            guest.send_json({"type": "join", "game": "petanque", "code": "ZZZZ", "name": "Sam"})
            self.assertEqual(guest.receive_json()["error"]["code"], "roomNotFound")

            host.send_json({"type": "create", "game": "petanque", "name": "Jack"})
            code = host.receive_json()["code"]
            host.send_json({"type": "lock", "locked": True})
            guest.send_json({"type": "join", "game": "petanque", "code": code, "name": "Sam"})
            self.assertEqual(guest.receive_json()["error"]["code"], "roomLocked")

    def testRoomClosesWhenHostLeaves(self):
        with self.connect() as guest:
            with self.connect() as host:
                host.send_json({"type": "create", "game": "petanque", "name": "Jack"})
                code = host.receive_json()["code"]
                guest.send_json({"type": "join", "game": "petanque", "code": code, "name": "Sam"})
                guest.receive_json()
            self.assertEqual(guest.receive_json()["type"], "roomClosed")
        self.assertEqual(rooms.registry.rooms, {})

    def testFullRoomAndBadMessages(self):
        sockets = [self.connect() for _ in range(5)]
        try:
            entered = [socket.__enter__() for socket in sockets]
            entered[0].send_json({"type": "create", "game": "petanque", "name": "Host"})
            code = entered[0].receive_json()["code"]
            for socket in entered[1:4]:
                socket.send_json({"type": "join", "game": "petanque", "code": code, "name": "Guest"})
                socket.receive_json()
            entered[4].send_json({"type": "join", "game": "petanque", "code": code, "name": "Late"})
            self.assertEqual(entered[4].receive_json()["error"]["code"], "roomFull")
            entered[4].send_text("not json")
            self.assertEqual(entered[4].receive_json()["error"]["code"], "badMessage")
            entered[4].send_json({"type": "create", "game": "chess", "name": "X"})
            self.assertEqual(entered[4].receive_json()["error"]["code"], "unknownGame")
        finally:
            for socket in sockets:
                socket.__exit__(None, None, None)


if __name__ == "__main__":
    unittest.main()
