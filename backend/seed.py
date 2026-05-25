"""
Script de peuplement (seed) de la base de données TMS
Crée les utilisateurs de test, entrepôts, véhicules et chauffeurs
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.utilisateur import Utilisateur, RoleEnum, StatutChauffeurEnum
from app.models.vehicule import Vehicule, StatutVehiculeEnum, VehiculeTypeEnum
from app.models.warehouse import Warehouse
from app.core.auth import get_password_hash
from app.config import settings

database_url = settings.DATABASE_URL
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(database_url)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def seed_database():
    async with AsyncSessionLocal() as db:
        print(" Démarrage du peuplement de la base de données...")

        # ==================== Entrepôts ====================
        print("\n Création des entrepôts...")
        warehouses = [
            Warehouse(
                nom="Entrepôt Nouakchott",
                ville="Nouakchott",
                adresse="Zone Industrielle, Nouakchott",
                lat=18.0735,
                lon=-15.9582,
                heure_ouverture="06:00",
                heure_fermeture="20:00",
                actif=True
            ),
            Warehouse(
                nom="Entrepôt Nouadhibou",
                ville="Nouadhibou",
                adresse="Port de Nouadhibou",
                lat=20.9316,
                lon=-17.0347,
                heure_ouverture="06:00",
                heure_fermeture="20:00",
                actif=True
            ),
        ]
        db.add_all(warehouses)
        await db.flush()

        warehouse_nkc = warehouses[0]
        warehouse_ndb = warehouses[1]
        print(f"   ✅ {len(warehouses)} entrepôts créés")


        print("\n👥 Création des utilisateurs...")
        users = [
            Utilisateur(
                nom="Administrateur",
                email="admin@tms.com",
                mot_de_passe=get_password_hash("admin123"),
                telephone="+22237000001",
                role=RoleEnum.ADMINISTRATEUR,
                actif=True,
                warehouse_id=warehouse_nkc.id
            ),
            Utilisateur(
                nom="Omar Dispatcher",
                email="omar.dispatcher@tms.com",
                mot_de_passe=get_password_hash("dispatcher123"),
                telephone="+22237000002",
                role=RoleEnum.DISPATCHEUR,
                actif=True,
                warehouse_id=warehouse_nkc.id
            ),
            Utilisateur(
                nom="Mohamed Chauffeur",
                email="med.ab.chauffeur1@tms.com",
                mot_de_passe=get_password_hash("chauffeur123"),
                telephone="+22237000003",
                role=RoleEnum.CHAUFFEUR,
                statut=StatutChauffeurEnum.DISPONIBLE,
                actif=True,
                warehouse_id=warehouse_nkc.id
            ),
            Utilisateur(
                nom="Ahmed Chauffeur",
                email="ahmed.chauffeur@tms.com",
                mot_de_passe=get_password_hash("chauffeur123"),
                telephone="+22237000004",
                role=RoleEnum.CHAUFFEUR,
                statut=StatutChauffeurEnum.DISPONIBLE,
                actif=True,
                warehouse_id=warehouse_nkc.id
            ),
            Utilisateur(
                nom="Expéditeur Test",
                email="expediteur@tms.com",
                mot_de_passe=get_password_hash("expediteur123"),
                telephone="+22237000005",
                role=RoleEnum.EXPEDITEUR,
                actif=True,
                warehouse_id=warehouse_nkc.id
            ),
        ]
        db.add_all(users)
        await db.flush()
        print(f"    {len(users)} utilisateurs créés")


        print("\n Création des véhicules...")
        vehicles = [
            Vehicule(
                immatriculation="5558AA06",
                capacite_poids=1000.0,
                capacite_volume=15.0,
                type_vehicule=VehiculeTypeEnum.NORMAL,
                ville="Nouakchott",
                warehouse_id=warehouse_nkc.id,
                statut=StatutVehiculeEnum.DISPONIBLE
            ),
            Vehicule(
                immatriculation="2207AB06",
                capacite_poids=800.0,
                capacite_volume=12.0,
                type_vehicule=VehiculeTypeEnum.REFRIGERE,
                ville="Nouakchott",
                warehouse_id=warehouse_nkc.id,
                statut=StatutVehiculeEnum.DISPONIBLE
            ),
            Vehicule(
                immatriculation="3542AE06",
                capacite_poids=1500.0,
                capacite_volume=20.0,
                type_vehicule=VehiculeTypeEnum.NORMAL,
                ville="Nouakchott",
                warehouse_id=warehouse_nkc.id,
                statut=StatutVehiculeEnum.DISPONIBLE
            ),
        ]
        db.add_all(vehicles)
        await db.flush()
        print(f"    {len(vehicles)} véhicules créés")


        await db.commit()




if __name__ == "__main__":
    asyncio.run(seed_database())
