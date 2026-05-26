import unittest
from pathlib import Path
import sys
from types import SimpleNamespace

from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.models.enums import RoleEnum  # noqa: E402
from app.routers.vehicules import delete_vehicule  # noqa: E402


class FakeResult:
    def __init__(self, one=None):
        self._one = one

    def scalar_one_or_none(self):
        return self._one


class FakeDB:
    def __init__(self, execute_results):
        self._results = list(execute_results)
        self.deleted = []
        self.commits = 0

    async def execute(self, _query):
        if not self._results:
            raise AssertionError("Aucun résultat simulé restant pour execute()")
        return self._results.pop(0)

    async def delete(self, obj):
        self.deleted.append(obj)

    async def commit(self):
        self.commits += 1


class TestVehiculesRoutesUnit(unittest.IsolatedAsyncioTestCase):
    async def test_delete_vehicule_refuse_si_reference_dans_tournees(self):
        vehicule = SimpleNamespace(id=10)
        tournee_ref = SimpleNamespace(id=99)

        db = FakeDB(
            [
                FakeResult(one=vehicule),  # véhicule
                FakeResult(one=tournee_ref),  # tournée référencée
            ]
        )

        with self.assertRaises(HTTPException) as ctx:
            await delete_vehicule(
                vehicule_id=10,
                db=db,
                current_user=SimpleNamespace(role=RoleEnum.ADMINISTRATEUR),
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("référencé dans des tournées", ctx.exception.detail)

    async def test_delete_vehicule_refuse_si_reference_dans_commandes(self):
        vehicule = SimpleNamespace(id=11)
        commande_ref = SimpleNamespace(id=501)

        db = FakeDB(
            [
                FakeResult(one=vehicule),  # véhicule
                FakeResult(one=None),  # aucune tournée
                FakeResult(one=commande_ref),  # commande référencée
            ]
        )

        with self.assertRaises(HTTPException) as ctx:
            await delete_vehicule(
                vehicule_id=11,
                db=db,
                current_user=SimpleNamespace(role=RoleEnum.ADMINISTRATEUR),
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("affecté à des commandes", ctx.exception.detail)

    async def test_delete_vehicule_reussit_si_aucune_reference(self):
        vehicule = SimpleNamespace(id=12)

        db = FakeDB(
            [
                FakeResult(one=vehicule),  # véhicule
                FakeResult(one=None),  # aucune tournée
                FakeResult(one=None),  # aucune commande
            ]
        )

        await delete_vehicule(
            vehicule_id=12,
            db=db,
            current_user=SimpleNamespace(role=RoleEnum.ADMINISTRATEUR),
        )

        self.assertIn(vehicule, db.deleted)
        self.assertEqual(db.commits, 1)


if __name__ == "__main__":
    unittest.main()
