import unittest
from types import SimpleNamespace
from pathlib import Path
import sys

from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.models.enums import RoleEnum, StatutCommandeEnum  # noqa: E402
from app.routers.commandes import affecter_commande, delete_commande  # noqa: E402


class FakeScalars:
    def __init__(self, items=None, first_item=None):
        self._items = items or []
        self._first_item = first_item

    def all(self):
        return self._items

    def first(self):
        if self._first_item is not None:
            return self._first_item
        return self._items[0] if self._items else None


class FakeResult:
    def __init__(self, one=None, items=None, first_item=None):
        self._one = one
        self._scalars = FakeScalars(items=items, first_item=first_item)

    def scalar_one_or_none(self):
        return self._one

    def scalars(self):
        return self._scalars


class FakeDB:
    def __init__(self, execute_results):
        self._results = list(execute_results)
        self.deleted = []
        self.commits = 0
        self.flushes = 0
        self.refreshed = []

    async def execute(self, _query):
        if not self._results:
            raise AssertionError("Aucun résultat simulé restant pour execute()")
        return self._results.pop(0)

    async def delete(self, obj):
        self.deleted.append(obj)

    async def commit(self):
        self.commits += 1

    async def flush(self):
        self.flushes += 1

    async def refresh(self, obj):
        self.refreshed.append(obj)


class TestCommandesRoutesUnit(unittest.IsolatedAsyncioTestCase):
    async def test_affecter_commande_refuse_vehicule_inexistant(self):
        commande = SimpleNamespace(
            id=1,
            vehicule_id=None,
            chauffeur_id=None,
            statut=StatutCommandeEnum.EN_ATTENTE,
        )
        payload = SimpleNamespace(vehicule_id=999, chauffeur_id=7)

        db = FakeDB(
            [
                FakeResult(one=commande),  # commande
                FakeResult(one=None),  # véhicule introuvable
            ]
        )

        with self.assertRaises(HTTPException) as ctx:
            await affecter_commande(
                commande_id=1,
                payload=payload,
                db=db,
                _current_user=SimpleNamespace(role=RoleEnum.DISPATCHEUR),
            )

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertIn("Véhicule", ctx.exception.detail)

    async def test_affecter_commande_refuse_utilisateur_non_chauffeur(self):
        commande = SimpleNamespace(
            id=1,
            vehicule_id=None,
            chauffeur_id=None,
            statut=StatutCommandeEnum.EN_ATTENTE,
        )
        vehicule = SimpleNamespace(id=10)
        utilisateur_non_chauffeur = SimpleNamespace(id=42, role=RoleEnum.EXPEDITEUR)
        payload = SimpleNamespace(vehicule_id=10, chauffeur_id=42)

        db = FakeDB(
            [
                FakeResult(one=commande),
                FakeResult(one=vehicule),
                FakeResult(one=utilisateur_non_chauffeur),
            ]
        )

        with self.assertRaises(HTTPException) as ctx:
            await affecter_commande(
                commande_id=1,
                payload=payload,
                db=db,
                _current_user=SimpleNamespace(role=RoleEnum.ADMINISTRATEUR),
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("n'est pas un chauffeur", ctx.exception.detail)

    async def test_delete_commande_detache_anomalies_avant_suppression_stops(self):
        commande = SimpleNamespace(
            id=55,
            expediteur_id=12,
            statut=StatutCommandeEnum.AFFECTEE,
            vehicule_id=7,
            chauffeur_id=8,
        )
        stop = SimpleNamespace(id=901, tournee_id=44)
        anomalie = SimpleNamespace(id=1, stop_id=901)
        tournee = SimpleNamespace(id=44)

        db = FakeDB(
            [
                FakeResult(one=commande),  # commande
                FakeResult(items=[stop]),  # stops de la commande
                FakeResult(items=[anomalie]),  # anomalies liées aux stops
                FakeResult(items=[], first_item=None),  # plus de stops sur la tournée
                FakeResult(one=tournee),  # tournée à supprimer
            ]
        )

        await delete_commande(
            commande_id=55,
            db=db,
            current_user=SimpleNamespace(role=RoleEnum.ADMINISTRATEUR, id=1),
        )

        self.assertIsNone(anomalie.stop_id)
        self.assertIn(stop, db.deleted)
        self.assertIn(tournee, db.deleted)
        self.assertEqual(commande.statut, StatutCommandeEnum.ANNULEE)
        self.assertIsNone(commande.vehicule_id)
        self.assertIsNone(commande.chauffeur_id)
        self.assertGreaterEqual(db.commits, 1)


if __name__ == "__main__":
    unittest.main()
