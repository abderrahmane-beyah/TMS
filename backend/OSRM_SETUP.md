# Configuration d'OSRM pour le routage en Mauritanie

Ce guide explique comment configurer OSRM (Open Source Routing Machine) avec les donnees du reseau routier mauritanien pour des calculs d'itineraires reels.

## Demarrage rapide (serveur OSRM public)

Le systeme est deja configure pour utiliser un serveur OSRM public par defaut :

```bash
# backend/.env
ROUTING_BACKEND=osrm
OSRM_URL=http://router.project-osrm.org
```

**Remarque :** Le serveur public couvre le monde entier, mais peut avoir des limitations de debit et des temps de reponse plus lents.

## Configuration OSRM locale (recommandee pour la production)

### Etape 1 : Telecharger les donnees cartographiques de la Mauritanie

```bash
cd backend/osrm-data

# Telecharger l'extrait OSM de la Mauritanie (~29MB)
curl -L -o mauritania-latest.osm.pbf https://download.geofabrik.de/africa/mauritania-latest.osm.pbf
```

### Etape 2 : Traiter les donnees cartographiques

**Pour les Mac Apple Silicon (M1/M2/M3) :**

```bash
# Extraire le reseau routier
docker run -t --rm \
  --platform linux/amd64 \
  -v "${PWD}:/data" \
  osrm/osrm-backend:latest \
  osrm-extract -p /opt/car.lua /data/mauritania-latest.osm.pbf

# Partitionner le graphe
docker run -t --rm \
  --platform linux/amd64 \
  -v "${PWD}:/data" \
  osrm/osrm-backend:latest \
  osrm-partition /data/mauritania-latest.osrm

# Personnaliser pour le routage voiture
docker run -t --rm \
  --platform linux/amd64 \
  -v "${PWD}:/data" \
  osrm/osrm-backend:latest \
  osrm-customize /data/mauritania-latest.osrm
```

**Pour les Mac Intel / Linux :**

```bash
# Extraire le reseau routier
docker run -t --rm \
  -v "${PWD}:/data" \
  osrm/osrm-backend:latest \
  osrm-extract -p /opt/car.lua /data/mauritania-latest.osm.pbf

# Partitionner le graphe
docker run -t --rm \
  -v "${PWD}:/data" \
  osrm/osrm-backend:latest \
  osrm-partition /data/mauritania-latest.osrm

# Personnaliser pour le routage voiture
docker run -t --rm \
  -v "${PWD}:/data" \
  osrm/osrm-backend:latest \
  osrm-customize /data/mauritania-latest.osrm
```

Cela cree les fichiers de routage traites (`mauritania-latest.osrm*`).

### Etape 3 : Ajouter OSRM a `docker-compose.yml`

Ajoutez ce service dans `backend/docker-compose.yml` :

```yaml
services:
  # ... services existants (postgres, redis) ...

  osrm:
    image: osrm/osrm-backend:latest
    container_name: osrm_mauritania
    ports:
      - "5000:5000"
    volumes:
      - ./osrm-data:/data
    command: osrm-routed --algorithm mld /data/mauritania-latest.osrm
    networks:
      - tms_network
```

### Etape 4 : Mettre a jour la configuration

Mettez a jour `backend/.env` :

```bash
ROUTING_BACKEND=osrm
OSRM_URL=http://osrm:5000  # Utiliser le nom du conteneur pour le reseau Docker interne
# Ou si vous accedez depuis l'exterieur de Docker :
# OSRM_URL=http://localhost:5000
```

### Etape 5 : Demarrer les services

```bash
cd backend
docker-compose up -d
```

OSRM sera disponible a l'adresse `http://localhost:5000`.

## Tester OSRM

Testez si OSRM fonctionne :

```bash
# Tester un itineraire du centre de Nouakchott vers le port
curl "http://localhost:5000/route/v1/driving/-15.9582,18.0735;-16.0000,18.0500?overview=false"
```

Reponse attendue :
```json
{
  "code": "Ok",
  "routes": [{
    "distance": 5234.5,  // metres
    "duration": 623.8    // secondes
  }]
}
```

## Comparaison des performances

| Methode de routage | Precision distance | Precision temps | Vitesse |
|--------------------|--------------------|-----------------|---------|
| **OSRM local** | ~95% | ~95% | 10-50 itineraires/s |
| **OSRM public** | ~95% | ~95% | 5-10 itineraires/s (limite de debit) |
| **Google Maps** | ~98% | ~98% | 5-10 itineraires/s (payant) |

## Mise a jour des donnees cartographiques

Pour mettre a jour avec les dernieres donnees OpenStreetMap :

```bash
cd backend/osrm-data
rm mauritania-latest.osm.pbf
wget https://download.geofabrik.de/africa/mauritania-latest.osm.pbf

# Re-traiter (meme commandes que l'etape 2)
# Puis redemarrer : docker-compose restart osrm
```

## Depannage

### Le conteneur OSRM s'arrete immediatement
- Verifiez que les fichiers `.osrm` existent dans `osrm-data/`
- Relancez les etapes de traitement

### Erreurs "No route found"
- Le point peut etre en dehors de la Mauritanie
- Le reseau routier peut ne pas connecter ces points
- Verifiez que les coordonnees sont au bon format (lon, lat)

### Routage lent
- Utilisez OSRM local au lieu du serveur public
- Verifiez la latence reseau
- Envisagez de mettre en cache les itineraires frequemment utilises

## Recommandations production

1. **Utilisez OSRM local** pour de meilleures performances
2. **Mettez a jour les donnees cartographiques** chaque mois depuis Geofabrik
3. **Mettez en cache les resultats** pour les itineraires frequemment utilises
4. **Surveillez** la sante du conteneur OSRM
5. **Sauvegardez** les fichiers `.osrm` traites (plus rapide qu'un retraitement)
