import enum

class RoleEnum(str, enum.Enum):
    EXPEDITEUR = "EXPEDITEUR"
    DISPATCHEUR = "DISPATCHEUR"
    CHAUFFEUR = "CHAUFFEUR"
    ADMINISTRATEUR = "ADMINISTRATEUR"

class StatutCommandeEnum(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"
    AFFECTEE = "AFFECTEE"
    EN_COURS = "EN_COURS"
    LIVREE = "LIVREE"
    ANNULEE = "ANNULEE"  # Commande annulée (non supprimée, juste marquée comme annulée)
    NON_AFFECTEE = "NON_AFFECTEE"  # Commande non affectée par l'optimisation (ne peut pas être servie)

class StatutTourneeEnum(str, enum.Enum):
    PLANIFIEE = "PLANIFIEE"
    EN_COURS = "EN_COURS"
    TERMINEE = "TERMINEE"

class StatutStopEnum(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"
    EN_COURS = "EN_COURS"
    LIVREE = "LIVREE"

class StatutVehiculeEnum(str, enum.Enum):
    DISPONIBLE = "DISPONIBLE"
    EN_MISSION = "EN_MISSION"
    HORS_SERVICE = "HORS_SERVICE"

class StatutChauffeurEnum(str, enum.Enum):
    DISPONIBLE = "DISPONIBLE"
    EN_MISSION = "EN_MISSION"
    HORS_SERVICE = "HORS_SERVICE"

class TypeAnomalieEnum(str, enum.Enum):
    RETARD = "RETARD"
    COLIS_ENDOMMAGE = "COLIS_ENDOMMAGE"
    ABSENCE_CLIENT = "ABSENCE_CLIENT"
    SIGNALEMENT_CHAUFFEUR = "SIGNALEMENT_CHAUFFEUR"

class StatutAnomalieEnum(str, enum.Enum):
    OUVERTE = "OUVERTE"
    RESOLUE = "RESOLUE"

class AlgorithmeEnum(str, enum.Enum):
    OR_TOOLS = "OR_TOOLS"

class StatutTacheEnum(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"
    EN_COURS = "EN_COURS"
    TERMINEE = "TERMINEE"
    ERREUR = "ERREUR"

class VehiculeTypeEnum(str, enum.Enum):
    NORMAL       = "NORMAL"
    REFRIGERE    = "REFRIGERE"
    CONGELATEUR  = "CONGELATEUR"

class TimeWindowTypeEnum(str, enum.Enum):
    HARD = "HARD"  # Doit livrer dans la fenêtre ou abandonner la commande
    SOFT = "SOFT"  # Peut livrer en retard avec pénalité