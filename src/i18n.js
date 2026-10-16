// -----------------------------------------------------------------------------
// User-facing texts, in the four languages the integration speaks.
//
// Gladys picks the right language from a multi-language object ({ en, fr,
// de, es }) everywhere it displays one: action messages, connection status,
// widget contents, toasts. Device and feature NAMES are plain strings stored
// at creation: they follow the `language` of the configuration (see name()).
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const MESSAGES = {
  missingCredentials: {
    en: 'Enter the e-mail and password of your Tineco account.',
    fr: 'Saisissez l’e-mail et le mot de passe de votre compte Tineco.',
    de: 'Geben Sie die E-Mail-Adresse und das Passwort Ihres Tineco-Kontos ein.',
    es: 'Introduzca el correo electrónico y la contraseña de su cuenta Tineco.',
  },
  verificationSent: {
    en: 'Tineco sent a verification code by e-mail: enter it in "Verification code" and save.',
    fr: 'Tineco a envoyé un code par e-mail : saisissez-le dans « Code de vérification » et enregistrez.',
    de: 'Tineco hat einen Code per E-Mail gesendet: Geben Sie ihn unter „Bestätigungscode“ ein und speichern Sie.',
    es: 'Tineco envió un código por correo: introdúzcalo en «Código de verificación» y guarde.',
  },
  verificationRefused: {
    en: 'Tineco refused the verification code. Send a new one with the button below.',
    fr: 'Tineco a refusé le code de vérification. Demandez-en un nouveau avec le bouton ci-dessous.',
    de: 'Tineco hat den Bestätigungscode abgelehnt. Fordern Sie unten einen neuen an.',
    es: 'Tineco rechazó el código de verificación. Solicite uno nuevo con el botón de abajo.',
  },
  authFailed: {
    en: 'Tineco refused the sign-in: check the e-mail, the password and the country.',
    fr: 'Tineco a refusé la connexion : vérifiez l’e-mail, le mot de passe et le pays.',
    de: 'Tineco hat die Anmeldung abgelehnt: Prüfen Sie E-Mail, Passwort und Land.',
    es: 'Tineco rechazó el inicio de sesión: compruebe el correo, la contraseña y el país.',
  },
  cloudUnreachable: {
    en: 'The Tineco cloud cannot be reached, new attempt at the next refresh.',
    fr: 'Le cloud Tineco est injoignable, nouvel essai au prochain rafraîchissement.',
    de: 'Die Tineco-Cloud ist nicht erreichbar, neuer Versuch bei der nächsten Aktualisierung.',
    es: 'La nube de Tineco no responde, nuevo intento en la próxima actualización.',
  },
  codeSent: {
    en: 'Code sent: check your mailbox, then enter it in "Verification code" and save.',
    fr: 'Code envoyé : consultez votre boîte mail, puis saisissez-le dans « Code de vérification » et enregistrez.',
    de: 'Code gesendet: Prüfen Sie Ihr Postfach, geben Sie ihn unter „Bestätigungscode“ ein und speichern Sie.',
    es: 'Código enviado: revise su correo, introdúzcalo en «Código de verificación» y guarde.',
  },
  noCodeNeeded: {
    en: 'Tineco does not ask for a code: the account is connected.',
    fr: 'Tineco ne demande pas de code : le compte est connecté.',
    de: 'Tineco verlangt keinen Code: Das Konto ist verbunden.',
    es: 'Tineco no pide ningún código: la cuenta está conectada.',
  },
  noDevice: {
    en: 'Connected, but Tineco lists no appliance for this account in this country: check that "Account country" is the one of the Tineco app (Profile > Settings), then test again.',
    fr: 'Connecté, mais Tineco ne liste aucun appareil pour ce compte dans ce pays : vérifiez que « Pays du compte » est celui de l’application Tineco (Profil > Paramètres), puis testez à nouveau.',
    de: 'Verbunden, aber Tineco listet für dieses Konto in diesem Land kein Gerät: Prüfen Sie, ob „Land des Kontos“ dem der Tineco-App entspricht (Profil > Einstellungen), und testen Sie erneut.',
    es: 'Conectado, pero Tineco no lista ningún aparato para esta cuenta en este país: compruebe que «País de la cuenta» es el de la app Tineco (Perfil > Ajustes) y vuelva a probar.',
  },
  deviceOffline: {
    en: 'The appliance did not answer: it is off or out of Wi-Fi range.',
    fr: 'L’appareil n’a pas répondu : il est éteint ou hors de portée du Wi-Fi.',
    de: 'Das Gerät hat nicht geantwortet: Es ist aus oder außerhalb der WLAN-Reichweite.',
    es: 'El aparato no respondió: está apagado o fuera del alcance del Wi-Fi.',
  },
  unknownDevice: {
    en: 'This appliance is not linked to the Tineco account anymore.',
    fr: 'Cet appareil n’est plus associé au compte Tineco.',
    de: 'Dieses Gerät ist nicht mehr mit dem Tineco-Konto verbunden.',
    es: 'Este aparato ya no está vinculado a la cuenta Tineco.',
  },
  commandSent: {
    en: 'Command sent to the appliance.',
    fr: 'Commande envoyée à l’appareil.',
    de: 'Befehl an das Gerät gesendet.',
    es: 'Orden enviada al aparato.',
  },
  statusRefreshed: {
    en: 'Status refreshed.',
    fr: 'État actualisé.',
    de: 'Status aktualisiert.',
    es: 'Estado actualizado.',
  },
};

/**
 * "Connected: N appliance(s)" — the answer of the test button.
 * @param {string[]} names
 */
export function devicesFound(names) {
  const list = names.join(', ');
  return {
    en: `Connected: ${names.length} appliance(s) found (${list}).`,
    fr: `Connecté : ${names.length} appareil(s) trouvé(s) (${list}).`,
    de: `Verbunden: ${names.length} Gerät(e) gefunden (${list}).`,
    es: `Conectado: ${names.length} aparato(s) encontrado(s) (${list}).`,
  };
}

// Names stored on the devices and features at creation, per language.
export const NAMES = {
  state: { en: 'State', fr: 'État', de: 'Zustand', es: 'Estado' },
  activity: { en: 'Activity', fr: 'Activité', de: 'Aktivität', es: 'Actividad' },
  battery: { en: 'Battery', fr: 'Batterie', de: 'Akku', es: 'Batería' },
  charging: { en: 'Charging', fr: 'En charge', de: 'Lädt', es: 'Cargando' },
  freshWater: {
    en: 'Clean water tank',
    fr: 'Réservoir d’eau propre',
    de: 'Frischwassertank',
    es: 'Depósito de agua limpia',
  },
  wasteWater: {
    en: 'Dirty water tank',
    fr: 'Réservoir d’eau sale',
    de: 'Schmutzwassertank',
    es: 'Depósito de agua sucia',
  },
  volume: {
    en: 'Voice volume',
    fr: 'Volume de la voix',
    de: 'Sprachlautstärke',
    es: 'Volumen de voz',
  },
  voicePrompts: {
    en: 'Voice prompts',
    fr: 'Annonces vocales',
    de: 'Sprachansagen',
    es: 'Avisos de voz',
  },
  brushLight: {
    en: 'Brush light',
    fr: 'Éclairage de la brosse',
    de: 'Bürstenbeleuchtung',
    es: 'Luz del cepillo',
  },
};

export const ACTIVITY_LABELS = {
  cleaning: { en: 'Cleaning', fr: 'Nettoyage', de: 'Reinigung', es: 'Limpiando' },
  self_cleaning: {
    en: 'Self-cleaning',
    fr: 'Auto-nettoyage',
    de: 'Selbstreinigung',
    es: 'Autolimpieza',
  },
  drying: { en: 'Drying', fr: 'Séchage', de: 'Trocknung', es: 'Secado' },
  charging: { en: 'Charging', fr: 'En charge', de: 'Lädt', es: 'Cargando' },
  updating: {
    en: 'Updating',
    fr: 'Mise à jour',
    de: 'Aktualisierung',
    es: 'Actualizando',
  },
  standby: { en: 'Standby', fr: 'En veille', de: 'Bereitschaft', es: 'En espera' },
  offline: { en: 'Offline', fr: 'Hors ligne', de: 'Offline', es: 'Sin conexión' },
};

/** The text of `message` in `language`, English when it has none. */
export function name(message, language) {
  return message[language] ?? message.en;
}
