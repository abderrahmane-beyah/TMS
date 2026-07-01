from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.warehouse import Warehouse
from app.models.enums import RoleEnum
from app.schemas.warehouse import WarehouseCreate, WarehouseUpdate, WarehouseResponse
from app.core.dependencies import get_current_user, require_role
from app.models.utilisateur import Utilisateur

router = APIRouter(prefix="/api/v1/warehouses", tags=["Warehouses"])


@router.get("/", response_model=list[WarehouseResponse])
async def list_warehouses(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = select(Warehouse)
    if not include_inactive:
        query = query.where(Warehouse.actif == True)
    result = await db.execute(query.order_by(Warehouse.ville, Warehouse.nom))
    return result.scalars().all()


@router.get("/{warehouse_id}", response_model=WarehouseResponse)
async def get_warehouse(
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Entrepôt introuvable")
    return warehouse


@router.post("/", response_model=WarehouseResponse)
async def create_warehouse(
    data: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(
        require_role(RoleEnum.ADMINISTRATEUR)
    )
):
    warehouse = Warehouse(**data.model_dump(), actif=True)
    db.add(warehouse)
    await db.commit()
    await db.refresh(warehouse)
    return warehouse


@router.patch("/{warehouse_id}", response_model=WarehouseResponse)
async def update_warehouse(
    warehouse_id: int,
    data: WarehouseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(
        require_role(RoleEnum.ADMINISTRATEUR)
    )
):
    result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Entrepôt introuvable")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(warehouse, field, value)

    await db.commit()
    await db.refresh(warehouse)
    return warehouse


@router.delete("/{warehouse_id}")
async def delete_warehouse(
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(
        require_role(RoleEnum.ADMINISTRATEUR)
    )
):
    result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Entrepôt introuvable")

    warehouse.actif = False
    await db.commit()
    return {"message": "Entrepôt désactivé"}
