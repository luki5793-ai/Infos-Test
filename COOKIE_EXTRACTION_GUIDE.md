# Cookie Extraction Guide - LinkedIn & Xing Login

Da LinkedIn und Xing oft automatische Logins blockieren (CAPTCHA, 2FA), kannst du stattdessen deine Browser-Session-Cookies verwenden.

## Warum Cookies statt E-Mail/Passwort?

✅ **Umgeht CAPTCHA** - Keine Bot-Erkennung
✅ **Funktioniert mit 2FA** - Du loggst dich normal im Browser ein
✅ **Sicherer** - Keine Passwörter im Klartext
✅ **Zuverlässiger** - Nutzt deine bestehende Session

## Schritt-für-Schritt Anleitung

### Option 1: Chrome/Edge DevTools (Einfach)

#### 1. Bei LinkedIn/Xing einloggen
- Öffne **Chrome** oder **Edge**
- Gehe zu https://www.linkedin.com (oder https://www.xing.com)
- Logge dich **normal** ein (mit 2FA falls aktiviert)

#### 2. DevTools öffnen
- Drücke **F12** oder Rechtsklick > "Untersuchen"
- Gehe zum Tab **"Application"** (oder "Anwendung" auf Deutsch)

#### 3. Cookies anzeigen
- Linke Seitenleiste: **Storage** > **Cookies** > **https://www.linkedin.com**
- Du siehst jetzt alle Cookies

#### 4. Cookies exportieren

**Methode A: Browser-Extension (Empfohlen)**

1. Installiere Extension: [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg)
2. Klicke auf das Cookie-Icon in der Toolbar
3. Klicke auf "Export" (📋 Icon)
4. Cookies werden als JSON kopiert

**Methode B: Manuell in Console**

1. Gehe zum Tab **"Console"** in DevTools
2. Füge diesen Code ein und drücke Enter:

```javascript
copy(JSON.stringify(
  document.cookie.split('; ').map(c => {
    const [name, value] = c.split('=');
    return {
      name,
      value,
      domain: '.linkedin.com', // oder '.xing.com'
      path: '/',
      secure: true,
      httpOnly: false
    };
  })
));
```

3. Cookies sind jetzt in deiner Zwischenablage als JSON

#### 5. In Apify Actor einfügen

1. Öffne deinen Apify Actor
2. Füge die Cookies in das Feld **"LinkedIn Session Cookies"** ein
3. Das Format sollte so aussehen:

```json
[
  {
    "name": "li_at",
    "value": "AQEDARabcdefg...",
    "domain": ".linkedin.com",
    "path": "/",
    "secure": true,
    "httpOnly": true
  },
  {
    "name": "JSESSIONID",
    "value": "ajax:1234567890",
    "domain": ".linkedin.com",
    "path": "/",
    "secure": true
  }
]
```

### Option 2: Firefox

#### 1. Bei LinkedIn/Xing einloggen
- Öffne **Firefox**
- Gehe zu https://www.linkedin.com
- Logge dich ein

#### 2. DevTools öffnen
- Drücke **F12**
- Gehe zum Tab **"Speicher"** (Storage)

#### 3. Cookies anzeigen
- Linke Seitenleiste: **Cookies** > **https://www.linkedin.com**

#### 4. Cookies exportieren

**Option A: Firefox Extension**
- Installiere [Cookie Quick Manager](https://addons.mozilla.org/de/firefox/addon/cookie-quick-manager/)
- Exportiere als JSON

**Option B: Console**
- Nutze denselben JavaScript-Code wie bei Chrome (siehe oben)

## Wichtige Cookies

### LinkedIn
Die wichtigsten Cookies sind:
- **li_at** - Authentifizierungs-Token (MUSS vorhanden sein)
- **JSESSIONID** - Session-ID
- **liap** - Zugriffs-Token

### Xing
Die wichtigsten Cookies sind:
- **xing_csrf_token** - CSRF-Token
- **login** - Login-Session
- **visit** - Besuchs-Token

## Troubleshooting

### "Cookies expired or invalid"

**Problem:** Cookies sind abgelaufen
**Lösung:**
1. Logge dich erneut im Browser ein
2. Exportiere neue Cookies
3. Update den Apify Actor Input

### "Cookie loading error"

**Problem:** JSON-Format ist falsch
**Lösung:**
1. Stelle sicher, dass es valides JSON ist
2. Nutze einen JSON-Validator: https://jsonlint.com
3. Achte auf korrekte Anführungszeichen (`"` nicht `'`)

### "Login failed" trotz Cookies

**Problem:** Falsche/Fehlende Cookies
**Lösung:**
1. Stelle sicher, dass du **ALLE** Cookies exportiert hast
2. Besonders wichtig: `li_at` (LinkedIn) oder `login` (Xing)
3. Prüfe, ob `domain` korrekt ist (`.linkedin.com` mit Punkt am Anfang)

## Sicherheitshinweise

⚠️ **Cookies sind wie Passwörter**
- Teile sie mit niemandem
- Sie ermöglichen Zugriff auf deinen Account
- Nutze sie nur in vertrauenswürdigen Umgebungen

⚠️ **Cookie-Lebensdauer**
- LinkedIn-Cookies laufen nach ~30 Tagen ab
- Xing-Cookies nach ~14 Tagen
- Bei Logout werden alle Cookies ungültig
- Musst sie regelmäßig aktualisieren

⚠️ **Best Practices**
- Nutze einen separaten Browser-Profil für Scraping
- Lösche Cookies aus Apify nach Verwendung
- Ändere dein Passwort, falls Cookies kompromittiert wurden

## Alternative: Cookie-Export Tools

### Chrome Extensions
1. **EditThisCookie** - https://www.editthiscookie.com/
2. **Cookie-Editor** - https://cookie-editor.cgagnier.ca/

### Firefox Add-ons
1. **Cookie Quick Manager**
2. **Cookie-Editor**

## Beispiel: Vollständiger Input

```json
{
  "jobTitles": ["CTO", "IT-Leiter"],
  "locations": ["München", "Berlin"],
  "maxLeadsPerSearch": 50,
  "enableLinkedInScraping": true,
  "enableXingScraping": true,
  "linkedInSessionCookies": "[{\"name\":\"li_at\",\"value\":\"AQE...xyz\",\"domain\":\".linkedin.com\",\"path\":\"/\",\"secure\":true,\"httpOnly\":true}]",
  "xingSessionCookies": "[{\"name\":\"login\",\"value\":\"abc...123\",\"domain\":\".xing.com\",\"path\":\"/\",\"secure\":true}]"
}
```

## Häufig gestellte Fragen

**Q: Wie lange sind Cookies gültig?**
A: LinkedIn ~30 Tage, Xing ~14 Tage. Variiert je nach Session-Einstellungen.

**Q: Kann ich beide Methoden gleichzeitig nutzen?**
A: Ja! Der Actor versucht erst Cookies, dann E-Mail/Passwort als Fallback.

**Q: Funktionieren Cookies mit 2FA?**
A: Ja! Du loggst dich ja bereits im Browser mit 2FA ein.

**Q: Muss ich ALLE Cookies exportieren?**
A: Nein, aber je mehr desto besser. Mindestens `li_at` (LinkedIn) oder `login` (Xing).

**Q: Kann ich Cookies von einem anderen Computer nutzen?**
A: Nein, Cookies sind an IP-Adresse und Browser-Fingerprint gebunden.

---

**Support:** Bei Problemen siehe Actor-Logs für detaillierte Fehlermeldungen.
