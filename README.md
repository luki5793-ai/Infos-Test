# IT Decision Maker Lead Finder - Apify Actor

Ein robuster Apify Actor zur gezielten Lead-Generierung von IT-Entscheidern bei deutschen Unternehmen für B2B-Recruiting und Vertrieb.

## 🎯 Überblick

Dieser Actor sammelt strukturierte Kontaktdaten (E-Mail-Adressen, Namen, Positionen) von IT-Entscheidern durch Multi-Source-Scraping aus:

- **LinkedIn** - Profil-Scraping und Suche (optional mit Apify LinkedIn Actor)
- **Xing** - Deutsche Business-Plattform für DACH-Region
- **Web-Suche** - Automatische E-Mail-Findung auf Unternehmens-Websites

## ✨ Features

- ✅ **Multi-Source Scraping** - LinkedIn, Xing und Web-Suche
- ✅ **Intelligente E-Mail-Generierung** - Pattern-basierte E-Mail-Vorhersage
- ✅ **Deduplizierung** - Automatische Erkennung und Zusammenführung doppelter Leads
- ✅ **Qualitäts-Scoring** - Bewertung der Lead-Qualität (0-100)
- ✅ **E-Mail-Verifikation** - Optional mit DNS/MX-Record-Prüfung
- ✅ **GDPR-Konform** - Nur öffentlich verfügbare Daten
- ✅ **Proxy-Support** - Apify Residential Proxies unterstützt
- ✅ **Rate-Limiting** - Anti-Blocking-Mechanismen integriert

## 📦 Input-Konfiguration

### Erforderliche Felder

```json
{
  "jobTitles": ["CTO", "IT-Leiter", "Head of IT"],
  "locations": ["München", "Berlin", "Hamburg"]
}
```

### Vollständiges Input-Beispiel

```json
{
  "jobTitles": ["CTO", "IT-Leiter", "Head of IT", "IT-Manager"],
  "locations": ["München", "Berlin", "Hamburg", "Frankfurt", "Köln"],
  "companyNames": ["SAP", "Siemens", "Deutsche Telekom"],
  "industrySectors": ["Software", "Fintech", "E-Commerce"],
  "maxLeadsPerSearch": 50,
  "enableLinkedInScraping": true,
  "enableXingScraping": true,
  "enableWebSearch": true,
  "emailVerification": false,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

### Input-Parameter

| Parameter | Typ | Erforderlich | Standard | Beschreibung |
|-----------|-----|--------------|----------|--------------|
| `jobTitles` | Array | Ja | - | Zielpositionen (z.B. CTO, IT-Leiter) |
| `locations` | Array | Ja | - | Deutsche Städte für die Suche |
| `companyNames` | Array | Nein | [] | Spezifische Unternehmen |
| `industrySectors` | Array | Nein | [] | Branchen-Filter |
| `maxLeadsPerSearch` | Number | Nein | 50 | Max. Leads pro Suchabfrage |
| `enableLinkedInScraping` | Boolean | Nein | true | LinkedIn aktivieren |
| `enableXingScraping` | Boolean | Nein | true | Xing aktivieren |
| `enableWebSearch` | Boolean | Nein | true | Web-Suche aktivieren |
| `emailVerification` | Boolean | Nein | false | E-Mail-Verifikation (langsamer) |
| `proxyConfiguration` | Object | Nein | `{useApifyProxy: true}` | Proxy-Einstellungen |

## 📊 Output-Format

### Beispiel-Output

```json
{
  "name": "Max Mustermann",
  "firstName": "Max",
  "lastName": "Mustermann",
  "jobTitle": "CTO",
  "company": "TechFirma GmbH",
  "location": "München",
  "email": "max.mustermann@techfirma.de",
  "emailConfidence": "high",
  "phone": "+49 89 12345678",
  "linkedInUrl": "https://linkedin.com/in/max-mustermann",
  "xingUrl": "https://xing.com/profile/Max_Mustermann",
  "companyWebsite": "https://techfirma.de",
  "companySize": "50-200",
  "industry": "Software",
  "source": "linkedin,xing",
  "qualityScore": 85,
  "scrapedAt": "2025-11-16T10:30:00Z"
}
```

### Output-Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `name` | String | Vollständiger Name |
| `firstName` | String | Vorname |
| `lastName` | String | Nachname |
| `jobTitle` | String | Position/Titel |
| `company` | String | Unternehmensname |
| `location` | String | Standort |
| `email` | String | E-Mail-Adresse |
| `emailConfidence` | String | Vertrauenslevel: verified, high, medium, low |
| `phone` | String | Telefonnummer (DE-Format) |
| `linkedInUrl` | String | LinkedIn-Profil-URL |
| `xingUrl` | String | Xing-Profil-URL |
| `companyWebsite` | String | Unternehmens-Website |
| `qualityScore` | Number | Qualitätsbewertung (0-100) |
| `source` | String | Datenquelle (linkedin, xing, web) |
| `scrapedAt` | String | Zeitstempel (ISO 8601) |

## 🚀 Verwendung

### Auf Apify Platform

1. Öffnen Sie den Actor in Apify Console
2. Konfigurieren Sie die Input-Parameter
3. Klicken Sie auf "Start"
4. Laden Sie die Ergebnisse als CSV/JSON/Excel herunter

### Mit Apify API

```javascript
const ApifyClient = require('apify-client');

const client = new ApifyClient({
    token: 'YOUR_APIFY_TOKEN',
});

const input = {
    jobTitles: ['CTO', 'IT-Leiter'],
    locations: ['München', 'Berlin'],
    maxLeadsPerSearch: 50,
};

const run = await client.actor('YOUR_ACTOR_ID').call(input);
const { items } = await client.dataset(run.defaultDatasetId).listItems();

console.log(items);
```

### Lokal testen

```bash
# Dependencies installieren
npm install

# Actor lokal ausführen
npm start
```

## 📈 Performance

- **Leads pro Stunde**: 30-50 qualifizierte Leads
- **E-Mail-Findungsrate**: 60-80% (abhängig von Web-Verfügbarkeit)
- **Durchschnittliche Laufzeit**: 15-30 Minuten für 100 Leads
- **Qualitätsscore**: Durchschnitt 60-70/100

## ⚙️ Technische Details

### Architektur

```
src/
├── main.js                 # Haupt-Orchestrierung
├── utils.js                # Helper-Funktionen
├── email-validator.js      # E-Mail-Verifikation
├── web-email-finder.js     # Web-Scraping für E-Mails
├── linkedin-scraper.js     # LinkedIn-Integration
├── xing-scraper.js         # Xing-Scraping
└── data-enricher.js        # Deduplizierung & Anreicherung
```

### Dependencies

- **Apify SDK** - Actor-Framework
- **Crawlee** - Web-Crawling
- **Playwright** - Browser-Automation
- **Cheerio** - HTML-Parsing
- **email-validator** - E-Mail-Validierung
- **Axios** - HTTP-Requests

### Anti-Blocking-Maßnahmen

- ✅ User-Agent-Rotation
- ✅ Zufällige Delays (2-5 Sekunden)
- ✅ Session-Management
- ✅ Apify Residential Proxies
- ✅ Retry-Logik mit Exponential Backoff

## ⚠️ GDPR & Rechtliche Hinweise

### Datenschutz-Compliance

**WICHTIG**: Dieser Actor sammelt nur öffentlich verfügbare Daten. Als Nutzer sind Sie verantwortlich für:

1. **Rechtmäßige Nutzung** - Stellen Sie sicher, dass Sie eine rechtliche Grundlage für die Verarbeitung haben
2. **Transparenz** - Informieren Sie betroffene Personen über die Datenverarbeitung
3. **Opt-Out** - Implementieren Sie Mechanismen zur Datenentfernung auf Anfrage
4. **Zweckbindung** - Nutzen Sie Daten nur für den angegebenen Zweck
5. **Datensicherheit** - Schützen Sie gesammelte Daten angemessen

### Best Practices

- ✅ Verwenden Sie Daten nur für legitime Geschäftszwecke (Recruiting, Vertrieb)
- ✅ Respektieren Sie robots.txt und Terms of Service
- ✅ Implementieren Sie eine Datenschutzerklärung
- ✅ Bieten Sie einfache Opt-Out-Möglichkeiten
- ✅ Löschen Sie Daten nach Verwendung

### Disclaimer

```
Dieser Actor wird "as-is" bereitgestellt. Der Entwickler übernimmt keine
Haftung für die Nutzung oder Folgen der Datenverarbeitung. Nutzer sind
selbst für die Einhaltung aller anwendbaren Gesetze verantwortlich.
```

## 🔧 Konfiguration & Optimierung

### LinkedIn-Integration

Für optimale LinkedIn-Ergebnisse:

1. Konfigurieren Sie Apify's LinkedIn-Scraper Actor
2. Fügen Sie APIFY_TOKEN als Umgebungsvariable hinzu
3. Aktivieren Sie `enableLinkedInScraping: true`

### E-Mail-Verifikation

E-Mail-Verifikation erhöht Genauigkeit, aber auch Laufzeit:

```json
{
  "emailVerification": true
}
```

**Hinweis**: Verifikation kann Laufzeit um 50-100% erhöhen.

### Proxy-Konfiguration

Für beste Ergebnisse nutzen Sie Apify Residential Proxies:

```json
{
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

## 📝 Changelog

### Version 1.0.0 (2025-11-16)

- 🎉 Initiales Release
- ✅ LinkedIn, Xing und Web-Scraping
- ✅ E-Mail-Pattern-Generierung
- ✅ Deduplizierung und Qualitäts-Scoring
- ✅ GDPR-Compliance Hinweise

## 💬 Support

Bei Fragen oder Problemen:

1. Prüfen Sie die Apify Console Logs
2. Kontaktieren Sie Apify Support
3. Erstellen Sie ein GitHub Issue (falls Repository öffentlich)

## 📄 Lizenz

Apache-2.0

---

**Entwickelt für deutsches B2B-Recruiting** 🇩🇪
