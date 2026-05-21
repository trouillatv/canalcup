// Configuration équipes — source unique partagée par le serveur (endpoints
// API) et le client (UI). Permet de changer la taille des équipes en
// modifiant une seule ligne.
//
// Canal Cup 2026 : modèle BINÔME. Une équipe = 1 captain + 1 coéquipier
// (max 2 membres). Les équipes existantes avec 3+ membres restent telles
// quelles (la contrainte ne s'applique qu'aux NOUVELLES jointures via
// /api/teams/join et /api/teams/requests/decide).

export const TEAM_MAX_MEMBERS = 2;
