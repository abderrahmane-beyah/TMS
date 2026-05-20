import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.utilisateur import Utilisateur
from app.models.vehicule import Vehicule
from app.models.enums import RoleEnum, StatutChauffeurEnum, StatutVehiculeEnum
from app.core.auth import hash_password
from mauritanian_names import get_random_person_name

async def seed():
    async with AsyncSessionLocal() as db:
        users_added = 0
        users_skipped = 0
        vehicules_added = 0
        vehicules_skipped = 0

        # ── USERS ──
        users_to_create = [
            # Admin
            Utilisateur(
                nom="Admin System",
                email="admin@tms.com",
                mot_de_passe=hash_password("admin123"),
                role=RoleEnum.ADMINISTRATEUR,
                ville="Nouakchott",
                actif=True
            ),
            # Dispatcheur
            Utilisateur(
                nom="Omar Dispatcher",
                email="omar.dispatcher@tms.com",
                mot_de_passe=hash_password("dispatcheur123"),
                role=RoleEnum.DISPATCHEUR,
                ville="Nouakchott",
                actif=True
            ),
        ]

        # ── EXPEDITEURS (3 total) ──
        expediteurs = [
            Utilisateur(
                nom="Société Mauritex",
                email="mauritex@tms.com",
                mot_de_passe=hash_password("expediteur123"),
                role=RoleEnum.EXPEDITEUR,
                ville="Nouakchott",
                actif=True
            ),
            Utilisateur(
                nom="Import-Export Al Wataniya",
                email="alwataniya@tms.com",
                mot_de_passe=hash_password("expediteur123"),
                role=RoleEnum.EXPEDITEUR,
                ville="Nouadhibou",
                actif=True
            ),
            Utilisateur(
                nom="Commerce Transfrontalier Rosso",
                email="rosso.export@tms.com",
                mot_de_passe=hash_password("expediteur123"),
                role=RoleEnum.EXPEDITEUR,
                ville="Rosso",
                actif=True
            ),
        ]
        users_to_create.extend(expediteurs)

        # ── CHAUFFEURS ──
        # 5 for Nouakchott, 2 for each other city (total 11)
        chauffeur_config = {
            'Nouakchott': 5,
            'Nouadhibou': 2,
            'Rosso': 2,
            'Kaédi': 2,
        }

        chauffeur_num = 1
        for ville, count in chauffeur_config.items():
            for i in range(count):
                nom = get_random_person_name('male')
                email = f"chauffeur{chauffeur_num}@tms.com"

                users_to_create.append(Utilisateur(
                    nom=f"{nom}",
                    email=email,
                    mot_de_passe=hash_password("chauffeur123"),
                    role=RoleEnum.CHAUFFEUR,
                    ville=ville,
                    statut=StatutChauffeurEnum.DISPONIBLE,
                    actif=True
                ))
                chauffeur_num += 1

        # ── VEHICLES ──
        # 8 for Nouakchott, 3 for each other city (total 17)
        vehicule_config = {
            'Nouakchott': 8,
            'Nouadhibou': 3,
            'Rosso': 3,
            'Kaédi': 3,
        }

        vehicules = []
        plate_number = 1000  # Starting number for plates

        for ville, count in vehicule_config.items():
            for i in range(count):
                # Generate consecutive plate: 1000AA06, 1001AA06, etc.
                immatriculation = f"{plate_number}AA06"

                # Vary capacity slightly
                # Nouakchott gets larger trucks on average
                if ville == 'Nouakchott':
                    capacite_poids = 800.0 + (i * 100)  # 800-1500kg
                    capacite_volume = 8.0 + (i * 1.0)   # 8-15m³
                else:
                    capacite_poids = 700.0 + (i * 100)  # 700-900kg
                    capacite_volume = 7.0 + (i * 0.5)   # 7-8m³

                vehicules.append(Vehicule(
                    immatriculation=immatriculation,
                    capacite_poids=capacite_poids,
                    capacite_volume=capacite_volume,
                    ville=ville,
                    statut=StatutVehiculeEnum.DISPONIBLE
                ))

                plate_number += 1

        # ── CHECK AND ADD USERS ──
        print("👥 Checking users...")
        for user in users_to_create:
            # Check if user exists by email
            result = await db.execute(
                select(Utilisateur).where(Utilisateur.email == user.email)
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"   ⏭️  Skipping {user.email} (already exists)")
                users_skipped += 1
            else:
                db.add(user)
                users_added += 1

        # ── CHECK AND ADD VEHICLES ──
        print("\n🚗 Checking vehicles...")
        for vehicule in vehicules:
            # Check if vehicle exists by immatriculation
            result = await db.execute(
                select(Vehicule).where(Vehicule.immatriculation == vehicule.immatriculation)
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"   ⏭️  Skipping {vehicule.immatriculation} (already exists)")
                vehicules_skipped += 1
            else:
                db.add(vehicule)
                vehicules_added += 1

        # ── COMMIT TO DB ──
        await db.commit()

        # ── SUMMARY ──
        print("\n" + "=" * 70)
        print("✅ SEED COMPLETED SUCCESSFULLY")
        print("=" * 70)

        print("\n📊 SUMMARY")
        print(f"   Users added: {users_added}")
        print(f"   Users skipped (already exist): {users_skipped}")
        print(f"   Vehicles added: {vehicules_added}")
        print(f"   Vehicles skipped (already exist): {vehicules_skipped}")

        print("\n👥 USERS (TOTAL IN DB)")
        result = await db.execute(select(Utilisateur))
        all_users = result.scalars().all()
        print(f"   Total users: {len(all_users)}")
        for role in RoleEnum:
            count = sum(1 for u in all_users if u.role == role)
            if count > 0:
                print(f"   {role.value}: {count}")

        print("\n📍 USERS BY CITY (TOTAL IN DB)")
        for ville in ['Nouakchott', 'Nouadhibou', 'Rosso', 'Kaédi']:
            count = sum(1 for u in all_users if u.ville == ville)
            if count > 0:
                print(f"   {ville}: {count} users")

        print("\n🚗 VEHICLES (TOTAL IN DB)")
        result = await db.execute(select(Vehicule))
        all_vehicules = result.scalars().all()
        print(f"   Total vehicles: {len(all_vehicules)}")
        for ville in ['Nouakchott', 'Nouadhibou', 'Rosso', 'Kaédi']:
            count = sum(1 for v in all_vehicules if v.ville == ville)
            if count > 0:
                print(f"   {ville}: {count} vehicles")

        print("\n📋 SAMPLE USERS")
        expediteurs_db = [u for u in all_users if u.role == RoleEnum.EXPEDITEUR]
        print("   Expediteurs:")
        for exp in expediteurs_db[:3]:
            print(f"     • {exp.email} ({exp.ville})")

        print("\n   Chauffeurs (sample):")
        chauffeurs_db = [u for u in all_users if u.role == RoleEnum.CHAUFFEUR][:5]
        for ch in chauffeurs_db:
            print(f"     • {ch.nom} - {ch.email} ({ch.ville})")

        print("\n🚚 SAMPLE VEHICLES")
        for v in all_vehicules[:5]:
            print(f"   {v.immatriculation}: {v.capacite_poids}kg, {v.capacite_volume}m³ ({v.ville})")

        print("\n🔑 LOGIN CREDENTIALS")
        print("   Admin: admin@tms.com / admin123")
        print("   Dispatcheur: omar.dispatcher@tms.com / dispatcheur123")
        print("   Expediteur 1: mauritex@tms.com / expediteur123")
        print("   Expediteur 2: alwataniya@tms.com / expediteur123")
        print("   Expediteur 3: rosso.export@tms.com / expediteur123")
        print("   Chauffeurs: chauffeur1@tms.com ... chauffeur11@tms.com / chauffeur123")
        print("=" * 70)

if __name__ == "__main__":
    asyncio.run(seed())
