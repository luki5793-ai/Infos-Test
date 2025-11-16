/**
 * Xing scraper module with login support
 * Uses Playwright for browser automation
 */

import { PlaywrightCrawler } from 'crawlee';
import {
    generateEmailPatterns,
    extractDomain,
    parseFullName,
    randomDelay,
} from './utils.js';

/**
 * Load session cookies into browser
 * @param {Page} page - Playwright page
 * @param {string} cookiesJson - JSON string of cookies
 * @param {string} domain - Domain to set cookies for
 * @returns {Promise<boolean>} - Whether cookies were loaded successfully
 */
export async function loadSessionCookies(page, cookiesJson, domain = '.xing.com') {
    try {
        const cookies = JSON.parse(cookiesJson);

        const formattedCookies = cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || domain,
            path: cookie.path || '/',
            expires: cookie.expires || -1,
            httpOnly: cookie.httpOnly || false,
            secure: cookie.secure || false,
            sameSite: cookie.sameSite || 'Lax',
        }));

        await page.context().addCookies(formattedCookies);
        console.log(`✅ Loaded ${formattedCookies.length} session cookies`);
        return true;
    } catch (error) {
        console.log(`Cookie loading error: ${error.message}`);
        return false;
    }
}

/**
 * Login to Xing
 * @param {Page} page - Playwright page
 * @param {string} email - Xing email
 * @param {string} password - Xing password
 * @param {string} sessionCookies - Optional session cookies JSON
 * @returns {Promise<boolean>} - Whether login was successful
 */
export async function loginToXing(page, email, password, sessionCookies = null) {
    // Option 1: Use session cookies if provided
    if (sessionCookies) {
        console.log('🔑 Using Xing session cookies...');

        const cookiesLoaded = await loadSessionCookies(page, sessionCookies, '.xing.com');
        if (!cookiesLoaded) {
            console.log('⚠️ Failed to load session cookies, trying email/password login');
        } else {
            // Verify cookies work
            await page.goto('https://www.xing.com/feed', { waitUntil: 'networkidle' });
            await randomDelay(3000, 5000);

            const isLoggedIn = await page.evaluate(() => {
                return !window.location.href.includes('/login');
            });

            if (isLoggedIn) {
                console.log('✅ Xing session cookies are valid');
                return true;
            } else {
                console.log('⚠️ Session cookies expired or invalid, trying email/password login');
            }
        }
    }

    // Option 2: Use email/password login
    if (!email || !password) {
        console.log('⚠️ Xing credentials not provided');
        console.log('ℹ️  Provide either sessionCookies OR email+password to enable Xing scraping');
        return false;
    }

    try {
        console.log('🔑 Logging in to Xing with email/password...');

        await page.goto('https://login.xing.com/', { waitUntil: 'networkidle' });
        await randomDelay(2000, 3000);

        // Fill in credentials
        await page.fill('input[name="username"]', email);
        await page.fill('input[name="password"]', password);

        await randomDelay(1000, 2000);

        // Click login button
        await page.click('button[type="submit"]');

        await randomDelay(5000, 7000);

        // Check if login was successful
        const isLoggedIn = await page.evaluate(() => {
            return !window.location.href.includes('/login') &&
                   (window.location.href.includes('/feed') || window.location.href.includes('/profile'));
        });

        if (isLoggedIn) {
            console.log('✅ Xing login successful');
            return true;
        } else {
            console.log('❌ Xing login failed');
            console.log('ℹ️  If you see CAPTCHA or 2FA, use the manual cookie method (see LinkedIn instructions)');
            return false;
        }

    } catch (error) {
        console.log(`Xing login error: ${error.message}`);
        return false;
    }
}

/**
 * Search for profiles on Xing
 * @param {Page} page - Playwright page
 * @param {string} jobTitle - Job title
 * @param {string} location - Location
 * @param {number} maxResults - Maximum results
 * @returns {Promise<Array<Object>>} - Found profiles
 */
export async function searchXingProfiles(page, jobTitle, location, maxResults = 50) {
    const profiles = [];

    try {
        const keywords = `${jobTitle} ${location}`.trim();
        const searchUrl = `https://www.xing.com/search/members?keywords=${encodeURIComponent(keywords)}`;

        console.log(`🔍 Searching Xing: ${jobTitle} in ${location}`);

        await page.goto(searchUrl, { waitUntil: 'networkidle' });
        await randomDelay(3000, 5000);

        // Scroll to load more results
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await randomDelay(2000, 3000);
        }

        // Extract profile data from search results
        const searchResults = await page.evaluate(() => {
            const results = [];

            // Try multiple selectors as Xing's HTML structure varies
            const selectors = [
                '.search-result-item',
                '[data-testid="search-result"]',
                '.profile-mini-profile',
                'article',
            ];

            let items = [];
            for (const selector of selectors) {
                items = document.querySelectorAll(selector);
                if (items.length > 0) break;
            }

            items.forEach(item => {
                try {
                    // Try to find name
                    let name = null;
                    const nameSelectors = [
                        'a.user-name',
                        '.profile-name',
                        'h3 a',
                        '[data-testid="name"]',
                    ];

                    for (const selector of nameSelectors) {
                        const elem = item.querySelector(selector);
                        if (elem) {
                            name = elem.textContent?.trim();
                            break;
                        }
                    }

                    // Try to find job title
                    let jobTitle = null;
                    const titleSelectors = [
                        '.occupation',
                        '.job-title',
                        '[data-testid="occupation"]',
                        '.headline',
                    ];

                    for (const selector of titleSelectors) {
                        const elem = item.querySelector(selector);
                        if (elem) {
                            jobTitle = elem.textContent?.trim();
                            break;
                        }
                    }

                    // Try to find company
                    let company = null;
                    const companySelectors = [
                        '.company',
                        '.company-name',
                        '[data-testid="company"]',
                    ];

                    for (const selector of companySelectors) {
                        const elem = item.querySelector(selector);
                        if (elem) {
                            company = elem.textContent?.trim();
                            break;
                        }
                    }

                    // Try to find location
                    let location = null;
                    const locationSelectors = [
                        '.location',
                        '[data-testid="location"]',
                    ];

                    for (const selector of locationSelectors) {
                        const elem = item.querySelector(selector);
                        if (elem) {
                            location = elem.textContent?.trim();
                            break;
                        }
                    }

                    // Try to find profile URL
                    let xingUrl = null;
                    const linkElement = item.querySelector('a[href*="/profile/"]');
                    if (linkElement) {
                        xingUrl = linkElement.href;
                    }

                    const profile = {
                        name,
                        jobTitle,
                        company,
                        location,
                        xingUrl,
                    };

                    if (profile.name) {
                        results.push(profile);
                    }
                } catch (e) {
                    // Skip invalid items
                }
            });

            return results;
        });

        profiles.push(...searchResults.slice(0, maxResults));
        console.log(`✅ Found ${profiles.length} profiles on Xing`);

    } catch (error) {
        console.log(`Xing search error: ${error.message}`);
    }

    return profiles;
}

/**
 * Scrape detailed Xing profile
 * @param {Page} page - Playwright page
 * @param {string} profileUrl - Xing profile URL
 * @returns {Promise<Object|null>} - Profile details
 */
export async function scrapeXingProfile(page, profileUrl) {
    try {
        await page.goto(profileUrl, { waitUntil: 'networkidle' });
        await randomDelay(3000, 5000);

        const profileData = await page.evaluate(() => {
            const data = {
                name: null,
                jobTitle: null,
                company: null,
                location: null,
                companyWebsite: null,
            };

            // Extract name
            const nameElement = document.querySelector('h1.profile-header-name, h1');
            data.name = nameElement?.textContent?.trim() || null;

            // Extract job title
            const titleElement = document.querySelector('.occupation, .profile-headline');
            data.jobTitle = titleElement?.textContent?.trim() || null;

            // Extract company
            const companyElement = document.querySelector('.company-name, [data-testid="company"]');
            data.company = companyElement?.textContent?.trim() || null;

            // Extract location
            const locationElement = document.querySelector('.location, [data-testid="location"]');
            data.location = locationElement?.textContent?.trim() || null;

            return data;
        });

        return profileData;

    } catch (error) {
        console.log(`Failed to scrape Xing profile ${profileUrl}: ${error.message}`);
        return null;
    }
}

/**
 * Find IT decision makers on Xing with login
 * @param {Array<string>} jobTitles - Job titles
 * @param {Array<string>} locations - Locations
 * @param {Object} options - Options
 * @returns {Promise<Array<Object>>} - Found profiles
 */
export async function findITDecisionMakersXing(jobTitles, locations, options = {}) {
    const {
        maxLeadsPerSearch = 50,
        xingEmail = null,
        xingPassword = null,
        xingSessionCookies = null,
    } = options;

    const allProfiles = [];

    // Check if credentials OR session cookies are provided
    if (!xingEmail && !xingPassword && !xingSessionCookies) {
        console.log('⚠️ Xing credentials or session cookies not provided. Skipping Xing scraping.');
        console.log('ℹ️  Add xingEmail+xingPassword OR xingSessionCookies to enable Xing scraping.');
        return [];
    }

    try {
        const crawler = new PlaywrightCrawler({
            launchContext: {
                launchOptions: {
                    headless: true,
                },
            },
            maxRequestsPerCrawl: 100,
            requestHandler: async ({ page, request }) => {
                const { isLogin } = request.userData;

                if (isLogin) {
                    // Perform login (tries cookies first, then email/password)
                    const loginSuccess = await loginToXing(page, xingEmail, xingPassword, xingSessionCookies);

                    if (!loginSuccess) {
                        throw new Error('Xing login failed');
                    }

                    // After login, search for profiles
                    for (const jobTitle of jobTitles) {
                        for (const location of locations) {
                            const profiles = await searchXingProfiles(page, jobTitle, location, maxLeadsPerSearch);

                            // Enrich profiles with email patterns
                            for (const profile of profiles) {
                                const enriched = enrichXingProfile(profile);
                                allProfiles.push(enriched);
                            }

                            await randomDelay(5000, 8000);
                        }
                    }
                }
            },
        });

        // Start with login request
        await crawler.run([
            {
                url: 'https://login.xing.com/',
                userData: { isLogin: true },
            },
        ]);

    } catch (error) {
        console.log(`Xing scraping error: ${error.message}`);
    }

    return allProfiles;
}

/**
 * Enrich Xing profile with email patterns
 * @param {Object} profile - Xing profile
 * @param {string} companyWebsite - Company website
 * @returns {Object} - Enriched profile
 */
export function enrichXingProfile(profile, companyWebsite = null) {
    const enriched = { ...profile };

    if (!profile.name) {
        return enriched;
    }

    const { firstName, lastName } = parseFullName(profile.name);
    enriched.firstName = firstName;
    enriched.lastName = lastName;

    // Generate email patterns if we have company website
    const website = companyWebsite || profile.companyWebsite;
    if (website || profile.company) {
        const domain = extractDomain(website, profile.company);
        if (domain) {
            enriched.possibleEmails = generateEmailPatterns(firstName, lastName, domain);
            enriched.emailConfidence = website ? 'medium' : 'low';
        }
    }

    enriched.source = 'xing';

    return enriched;
}

/**
 * Search for company employees on Xing
 * @param {Page} page - Playwright page
 * @param {string} companyName - Company name
 * @param {Array<string>} jobTitles - Job titles to search for
 * @returns {Promise<Array<Object>>} - Found profiles
 */
export async function searchXingCompanyEmployees(page, companyName, jobTitles = []) {
    const profiles = [];

    for (const jobTitle of jobTitles) {
        const keywords = `${jobTitle} ${companyName}`;
        const searchUrl = `https://www.xing.com/search/members?keywords=${encodeURIComponent(keywords)}`;

        try {
            await page.goto(searchUrl, { waitUntil: 'networkidle' });
            await randomDelay(3000, 5000);

            const searchResults = await searchXingProfiles(page, jobTitle, companyName, 20);
            profiles.push(...searchResults);

        } catch (error) {
            console.log(`Xing company search error: ${error.message}`);
        }
    }

    return profiles;
}
