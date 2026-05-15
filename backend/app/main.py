from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, commandes, vehicules, chauffeurs, tournees, anomalies, kpis, admin
# from app.routers import optimisation as optimisation_router  # Désactivé en attendant la création des solvers
from app.models import *

app = FastAPI(title="TMS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(commandes.router)
app.include_router(vehicules.router)
app.include_router(chauffeurs.router)
app.include_router(tournees.router)
app.include_router(anomalies.router)
app.include_router(kpis.router)
app.include_router(admin.router)
# app.include_router(optimisation_router.router)  # Désactivé en attendant la création des solvers

@app.get("/")
async def root():
    return {"message": "TMS API is running"}