from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, timedelta
from app.database import get_db
from app.models.tournee import Tournee, StopTournee
from app.models.commande import Commande
from app.models.vehicule import Vehicule
from app.models.enums import StatutStopEnum, StatutTourneeEnum, RoleEnum
from app.core.dependencies import require_role

router = APIRouter(prefix="/api/v1/kpis", tags=["KPIs"])

@router.get("/otd")
async def otd(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR))
):
    today = date.today()
    last_30 = today - timedelta(days=30)
    result = await db.execute(
        select(Tournee).where(Tournee.date >= last_30)
    )
    tournees = result.scalars().all()

    data = []
    for t in tournees:
        stops_result = await db.execute(
            select(StopTournee).where(StopTournee.tournee_id == t.id)
        )
        stops = stops_result.scalars().all()
        total = len(stops)
        livres = sum(1 for s in stops if s.statut == StatutStopEnum.LIVREE)
        taux = round((livres / total) * 100, 1) if total > 0 else 0
        data.append({"date": str(t.date), "taux": taux})

    return data

@router.get("/utilisation")
async def utilisation(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR))
):
    result = await db.execute(select(Vehicule))
    vehicules = result.scalars().all()

    data = []
    for v in vehicules:
        tournees_result = await db.execute(
            select(Tournee).where(Tournee.vehicule_id == v.id)
        )
        tournees = tournees_result.scalars().all()
        total_days = 30
        active_days = len(set(t.date for t in tournees))
        taux = round((active_days / total_days) * 100, 1)
        data.append({"vehicule": v.immatriculation, "taux": taux})

    return data

@router.get("/cout-par-km")
async def cout_par_km(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR))
):
    today = date.today()
    last_30 = today - timedelta(days=30)
    result = await db.execute(
        select(Tournee).where(
            Tournee.date >= last_30,
            Tournee.distance_totale != None
        )
    )
    tournees = result.scalars().all()

    COUT_PAR_KM = 0.15  # USD per km
    data = []
    for t in tournees:
        cout = round(t.distance_totale * COUT_PAR_KM, 2) if t.distance_totale else 0
        data.append({"date": str(t.date), "cout": cout})

    return data

@router.get("/non-servies")
async def non_servies(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR))
):
    today = date.today()
    last_30 = today - timedelta(days=30)
    result = await db.execute(
        select(Commande).where(Commande.created_at >= last_30)
    )
    commandes = result.scalars().all()

    from collections import defaultdict
    daily = defaultdict(int)
    for c in commandes:
        day = str(c.created_at.date())
        if c.statut.value != "LIVREE":
            daily[day] += 1

    return [{"date": d, "count": n} for d, n in sorted(daily.items())]