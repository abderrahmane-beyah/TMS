import unittest
from pathlib import Path
import sys
from types import SimpleNamespace

from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.routers.anomalies import create_anomalie  # noqa: E402


class FakeResult:
    def __init__(self, one=None):
        self._one = one

    def scalar_one_or_none(self):
        return self._one


class FakeDB:
    def __init__(self, execute_results):
        self._results = list(execute_results)
        self.added = []
        self.commits = 0
        self.refreshed = []

    async def execute(self, _query):
        if not self._results:
            raise AssertionError("Aucun résultat simulé restant pour execute()")
        return self._results.pop(0)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def refresh(self, obj):
        self.refreshed.append(obj)


class TestAnomaliesRoutesUnit(unittest.IsolatedAsyncioTestCase):
    async def test_create_anomalie_refuse_tournee_introuvable(self):
        payload = SimpleNamespace(
            tournee_id=999,
            stop_id=None,
            type="RETARD",
            description="Test",
            model_dump=lambda: {
                "tournee_id": 999,
                "stop_id": None,
                "type": "RETARD",
                "description": "Test",
            },
        )
        db = FakeDB([FakeResult(one=None)])

        with self.assertRaises(HTTPException) as ctx:
            await create_anomalie(payload=payload, db=db, current_user=SimpleNamespace(id=1))

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertIn("Tournée", ctx.exception.detail)

    async def test_create_anomalie_refuse_stop_hors_tournee(self):
        payload = SimpleNamespace(
            tournee_id=10,
            stop_id=50,
            type="RETARD",
            description="Mismatch",
            model_dump=lambda: {
                "tournee_id": 10,
                "stop_id": 50,
                "type": "RETARD",
                "description": "Mismatch",
            },
        )

        tournee = SimpleNamespace(id=10)
        stop = SimpleNamespace(id=50, tournee_id=999)
        db = FakeDB([FakeResult(one=tournee), FakeResult(one=stop)])

        with self.assertRaises(HTTPException) as ctx:
            await create_anomalie(payload=payload, db=db, current_user=SimpleNamespace(id=1))

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("n'appartient pas", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
