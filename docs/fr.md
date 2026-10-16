# Tineco pour Gladys Assistant

Connecte à Gladys les laveurs de sols de votre compte Tineco (Floor One S3,
S5, S7, S7 Flashdry, S7 Stretch, iFloor… — tous les modèles visibles dans
l'application **Tineco**) : batterie, activité, réservoirs d'eau, annonces
vocales et éclairage de la brosse, ainsi que des déclencheurs et actions de
scène et des widgets de tableau de bord.

L'intégration passe par le **cloud Tineco**, comme l'application : l'appareil
doit être configuré dans l'application Tineco et connecté au Wi-Fi.

## Configuration

1. Dans Gladys, installez l'intégration **Tineco** et ouvrez son onglet
   **Configuration**.
2. Saisissez l'**e-mail** et le **mot de passe** de votre compte Tineco, et le
   **pays** choisi à la création du compte. Enregistrez.
3. À la première connexion, Tineco considère Gladys comme un nouveau téléphone
   et vous **envoie un code de vérification par e-mail**. Saisissez-le dans
   **Code de vérification** et enregistrez à nouveau. Cela n'arrive qu'une
   fois. Pas d'e-mail ? Utilisez **Recevoir un nouveau code de vérification**
   (un e-mail par quart d'heure au plus est envoyé automatiquement).
4. **Tester la connexion** liste les appareils trouvés.
5. Ouvrez l'onglet **Découverte** et créez vos appareils.

| Réglage                        | Rôle                                                            |
| ------------------------------ | --------------------------------------------------------------- |
| Pays du compte                 | Choisit les serveurs Tineco de votre compte.                    |
| Langue des noms                | Langue des noms des appareils et fonctionnalités à la création. |
| Intervalle de rafraîchissement | Secondes entre deux lectures de chaque appareil (30 minimum).   |

## Ce que vous obtenez

| Fonctionnalité         | Valeurs                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| État                   | État standard d'aspirateur : arrêté, en marche, en charge, sur sa base            |
| Activité               | Nettoyage, auto-nettoyage, séchage, en charge, mise à jour, en veille, hors ligne |
| Batterie               | 0–100 %                                                                           |
| En charge              | Oui / non                                                                         |
| Réservoir d'eau propre | Normal / bas (vide)                                                               |
| Réservoir d'eau sale   | Normal / haut (plein)                                                             |
| Volume de la voix      | 1 (faible) à 3 (fort), pilotable                                                  |
| Annonces vocales       | Activées / coupées, pilotable                                                     |
| Éclairage de la brosse | Allumé / éteint, pilotable — seulement sur les modèles qui en ont un              |

Quand un appareil ne répond pas (éteint, hors de portée du Wi-Fi — un modèle
à main ne se connecte que pendant l'utilisation), son badge passe à
**injoignable**, son activité à **hors ligne**, et les dernières valeurs sont
conservées.

## Scènes

**Déclencheurs**

- **Nettoyage démarré** — variable : batterie.
- **Nettoyage terminé** — variables : durée (minutes), batterie.
- **Auto-nettoyage terminé** — le moment de vider le réservoir d'eau sale.
- **Alerte réservoir** — réservoir d'eau sale plein ou réservoir d'eau propre
  vide ; filtre sur l'alerte, variable : alerte.

Chaque déclencheur peut être filtré sur un appareil.

**Actions**

- **Lire un appareil Tineco** — le lit immédiatement ; sorties : en ligne,
  activité, batterie, réservoir d'eau sale plein, réservoir d'eau propre vide
  (pour les conditions des actions suivantes).
- **Régler le volume de la voix**, **Activer ou couper les annonces
  vocales**, **Allumer ou éteindre l'éclairage de la brosse** — sortie :
  commande acceptée.

Un appareil hors ligne ne fait jamais échouer une scène : les sorties
l'indiquent.

## Widgets du tableau de bord

- **Appareil Tineco** — la jauge de batterie, l'activité, les réservoirs, la
  batterie sur 24 h et un bouton **Actualiser**. Choisissez l'appareil dans
  les réglages du widget (le premier sinon).
- **Vue d'ensemble Tineco** — une ligne par appareil, en orange quand un
  réservoir demande votre attention.

## Limites

- Tineco ne publie pas d'API : l'intégration utilise le protocole de
  l'application, que Tineco peut faire évoluer. Tous les modèles ne
  remontent pas toutes les valeurs ; l'éclairage de la brosse n'apparaît que
  sur les modèles qui le remontent.
- Lancer un nettoyage à distance n'est pas possible : un laveur de sols se
  pousse à la main.
- Les comptes de Chine continentale (connexion par SMS) ne sont pas pris en
  charge.

## Dépannage

- **« Tineco a refusé la connexion »** : vérifiez l'e-mail, le mot de passe et
  surtout le **pays** du compte.
- **« Tineco a refusé le code de vérification »** : les codes expirent ;
  utilisez **Recevoir un nouveau code de vérification** et saisissez le
  nouveau.
- **« Tineco ne liste aucun appareil »** : la liste vient des serveurs Tineco
  du pays choisi. Choisissez le pays affiché dans l'application Tineco (Profil
  > Paramètres), enregistrez et testez à nouveau. Toujours vide ? Partagez la
  > ligne « Answer shape » des logs (elle ne contient aucune donnée
  > personnelle) dans une issue.
- Logs de l'intégration : Gladys → Intégrations → Tineco → logs. Les mots de
  passe et jetons n'y apparaissent jamais.
