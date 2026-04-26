import asyncio
from app.database import AsyncSessionLocal
from app.models.utilisateur import Utilisateur
from app.models.vehicule import Vehicule
from app.models.enums import RoleEnum, StatutChauffeurEnum, StatutVehiculeEnum
from app.core.auth import hash_password

async def seed():
    async with AsyncSessionLocal() as db:
        # ── USERS ──
        users = [
            Utilisateur(
                nom="Admin System",
                email="admin@tms.com",
                mot_de_passe=hash_password("admin123"),
                role=RoleEnum.ADMINISTRATEUR,
                actif=True
            ),
            Utilisateur(
                nom="Omar Dispatcher",
                email="omar.dispatcher@tms.com",
                mot_de_passe=hash_password("dispatcheur123"),
                role=RoleEnum.DISPATCHEUR,
                actif=True
            ),
            Utilisateur(
                nom="Mohamed Chauffeur",
                email="med.ab.chauffeur1@tms.com",
                mot_de_passe=hash_password("chauffeur123"),
                role=RoleEnum.CHAUFFEUR,
                statut=StatutChauffeurEnum.DISPONIBLE,
                actif=True
            ),
            Utilisateur(
                nom="Ahmed Chauffeur",
                email="ahmed.chauffeur@tms.com",
                mot_de_passe=hash_password("chauffeur123"),
                role=RoleEnum.CHAUFFEUR,
                statut=StatutChauffeurEnum.DISPONIBLE,
                actif=True
            ),
            Utilisateur(
                nom="Société Mauritex",
                email="expediteur@tms.com",
                mot_de_passe=hash_password("expediteur123"),
                role=RoleEnum.EXPEDITEUR,
                actif=True
            ),
        ]

        # ── VEHICLES ──
        vehicules = [
            Vehicule(
                immatriculation="5558AA06",
                capacite_poids=1000.0,
                capacite_volume=10.0,
                statut=StatutVehiculeEnum.DISPONIBLE
            ),
            Vehicule(
                immatriculation="2207AB06",
                capacite_poids=800.0,
                capacite_volume=8.0,
                statut=StatutVehiculeEnum.DISPONIBLE
            ),
            Vehicule(
                immatriculation="3542AE06",
                capacite_poids=1500.0,
                capacite_volume=15.0,
                statut=StatutVehiculeEnum.DISPONIBLE
            ),
        ]

        db.add_all(users)
        db.add_all(vehicules)
        await db.commit()
        print("Seed completed successfully")
        print("── Users created ──")
        for u in users:
            print(f"  {u.role.value}: {u.email}")
        print("── Vehicles created ──")
        for v in vehicules:
            print(f"  {v.immatriculation} ({v.capacite_poids}kg)")

if __name__ == "__main__":
    asyncio.run(seed())