# ADR-0003 — Export calendrier : génération ICS sans dépendance

Statut : accepté · Date : 2026-08-21

## Contexte

Le cahier des charges demande un export au format calendrier standard « si
implémentable sans dépendance inutile », sinon un simple contrat d'interface.

## Décision

Implémenté sans dépendance : un fichier iCalendar (RFC 5545) est du texte
structuré ; `shared/lib/ics.ts` (~90 lignes testées) couvre le périmètre MVP :

- événements horodatés (UTC) et « journée entière » (`VALUE=DATE`) ;
- échappement RFC (virgules, points-virgules, sauts de ligne) ;
- pliage des lignes à 75 octets ;
- récurrence **dépliée en occurrences** par le domaine — pas de RRULE.

Le bouton « Ajouter à mon calendrier » (fiche événement) télécharge un `.ics`
généré côté client.

## Limites assumées

Pas de RRULE, de fuseaux VTIMEZONE ni d'ORGANIZER/ATTENDEE. Si un besoin réel
dépasse ce périmètre (abonnement de calendrier, mises à jour d'événements
`SEQUENCE`), réévaluer une bibliothèque dédiée dans un nouvel ADR plutôt que
d'étendre indéfiniment le générateur maison.
