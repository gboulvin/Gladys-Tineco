# [Intégration externe] Tineco : vos laveurs de sols dans Gladys 🧽

Bonjour à tous,

Suite à la [demande d'intégration pour les aspirateurs laveurs Tineco](https://community.gladysassistant.com/t/demande-d-integration-externe-pour-robot-aspirateur-laveur-tineco/11319),
je vous présente **l'intégration externe Tineco** pour Gladys 5.1+ !

Elle connecte à Gladys les appareils de votre compte Tineco (Floor One S3, S5,
S7, S7 Flashdry, S7 Stretch, iFloor… tout ce que montre l'application
Tineco), via le cloud Tineco, comme l'application officielle.

## Ce qu'elle remonte

- **État** (standard aspirateur Gladys) et **activité** détaillée : nettoyage,
  auto-nettoyage, séchage, en charge, mise à jour, en veille, hors ligne
- **Batterie** et **charge en cours**
- **Réservoir d'eau propre** (vide) et **réservoir d'eau sale** (plein)
- **Volume de la voix**, **annonces vocales** et **éclairage de la brosse**
  (sur les modèles équipés), pilotables depuis Gladys
- Badge **cloud / injoignable** quand l'appareil est éteint ou hors Wi-Fi

## Scènes

- Déclencheurs : **nettoyage démarré**, **nettoyage terminé** (avec la durée),
  **auto-nettoyage terminé** (le moment idéal pour être prévenu de vider le
  bac d'eau sale 😉), **alerte réservoir**
- Actions : **lire un appareil** (sorties utilisables en condition : batterie,
  activité, réservoirs…), régler le volume, couper les annonces vocales,
  allumer/éteindre la lumière de la brosse

## Widgets du tableau de bord

- **Appareil Tineco** : jauge de batterie, activité, réservoirs, historique de
  batterie 24 h et bouton « Actualiser »
- **Vue d'ensemble Tineco** : une ligne par appareil, en orange si un réservoir
  demande votre attention

## Installation

1. Installez l'intégration **Tineco** depuis le catalogue des intégrations.
2. Saisissez l'e-mail, le mot de passe et le **pays** de votre compte Tineco.
3. À la première connexion, Tineco vous envoie un **code par e-mail** : saisissez-le
   dans « Code de vérification » et enregistrez (une seule fois).
4. Créez vos appareils depuis l'onglet **Découverte**.

L'intégration est disponible en **français, anglais, allemand et espagnol**.

## À savoir

Tineco ne publie pas d'API : l'intégration s'appuie sur le protocole de
l'application, documenté par la communauté (merci à l'auteur de
[Tineco-HACS-Integration](https://github.com/wheeller123/Tineco-HACS-Integration)
et au décodage du payload partagé sur ce forum). Tous les modèles ne remontent
pas toutes les valeurs : vos retours (modèle + ce qui marche / ne marche pas)
sont les bienvenus pour l'améliorer !

- Code source et documentation : https://github.com/gboulvin/Gladys-Tineco
- Bugs et suggestions : https://github.com/gboulvin/Gladys-Tineco/issues

Bon ménage ! 🧹
