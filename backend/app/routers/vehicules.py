from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.vehicule import Vehicule
from app.models.enums import RoleEnum
from app.schemas.vehicule import VehiculeCreate, VehiculeUpdate, VehiculeResponse
from app.core.dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/v1/vehicules", tags=["Véhicules"])

@router.get("/", response_model=list[VehiculeResponse])
async def list_vehicules(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Vehicule))
    return result.scalars().all()

@router.post("/", response_model=VehiculeResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicule(
    payload: VehiculeCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.ADMINISTRATEUR))
):
    vehicule = Vehicule(**payload.model_dump())
    db.add(vehicule)
    await db.commit()
    await db.refresh(vehicule)
    return vehicule

@router.patch("/{vehicule_id}", response_model=VehiculeResponse)
async def update_vehicule(
    vehicule_id: int,
    payload: VehiculeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.ADMINISTRATEUR))
):
    result = await db.execute(select(Vehicule).where(Vehicule.id == vehicule_id))
    vehicule = result.scalar_one_or_none()
    if not vehicule:
        raise HTTPException(status_code=404, detail="Véhicule introuvable")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(vehicule, key, value)
    await db.commit()
    await db.refresh(vehicule)
    return vehicule

@router.delete("/{vehicule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicule(
    vehicule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.ADMINISTRATEUR))
):
    result = await db.execute(select(Vehicule).where(Vehicule.id == vehicule_id))
    vehicule = result.scalar_one_or_none()
    if not vehicule:
        raise HTTPException(status_code=404, detail="Véhicule introuvable")
    await db.delete(vehicule)
    await db.commit()