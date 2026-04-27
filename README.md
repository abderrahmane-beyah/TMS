
# Système de Gestion du Transport et d'Optimisation des Tournées de Livraison


---

## Prérequis

Avant de lancer l'application, assurez-vous d'avoir installé :

- Python 3.12
- Node.js 18+
- Docker Desktop (pour PostgreSQL et Redis)

---

## Lancement de l'application

### 1. Cloner le projet

```bash
git clone https://github.com/abderrahmane-beyah/TMS.git
cd TMS
```

### 2. Démarrer la base de données et Redis

Démarrez Docker Desktop, puis lancez :

```bash
docker-compose up -d
```

### 3. Configurer et démarrer le backend

#### Créer l'environnement virtuel Python

**macOS / Linux :**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Windows (PowerShell) :**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Windows (CMD) :**
```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
```

#### Lancer le serveur backend

```bash
uvicorn app.main:app --reload
```

Le backend est accessible sur : `http://localhost:8000`
Documentation API : `http://localhost:8000/api/v1/docs`

### 4. Démarrer le worker Celery (optimisation)

Ouvrez un nouveau terminal dans le dossier `backend` :

**macOS / Linux :**
```bash
cd backend
source .venv/bin/activate
celery -A app.solver.tasks.celery_app worker --loglevel=info
```

**Windows :**
```powershell
cd backend
.venv\Scripts\Activate.ps1
celery -A app.solver.tasks.celery_app worker --loglevel=info --pool=solo
```


### 5. Démarrer le frontend

Ouvrez un nouveau terminal :

```bash
cd frontend
npm install
npm run dev
```

L'application est accessible sur : `http://localhost:5173`

---

## Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Administrateur | admin@tms.com | admin123 |
| Dispatcheur | omar.dispatcher@tms.com | dispatcher123 |
| Chauffeur | med.ab.chauffeur1@tms.com | chauffeur123 |
| Expéditeur | expediteur@tms.com | expediteur123 |

---

## Fonctionnalités principales

- **Gestion des commandes** — création, affectation, suivi
- **Gestion de la flotte** — véhicules et chauffeurs
- **Optimisation des tournées** — résolution du VRPTW
- **Suivi en temps réel** — carte interactive, statut des livraisons
- **Tableau de bord KPI** — taux de livraison, utilisation des véhicules
- **Gestion des anomalies** — signalement et résolution
- **Administration** — gestion des utilisateurs et des rôles

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend | FastAPI (Python 3.12) |
| Base de données | PostgreSQL 16 |
| File de tâches | Celery + Redis |
| Optimisation | OR-Tools (VRPTW) |
| Frontend | React 19 + TypeScript + Vite |
| Cartographie | Leaflet.js + OpenStreetMap |