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
 * Login to Xing
 * @param {Page} page - Playwright page
 * @param {string} email - Xing email
 * @param {string} password - Xing password
 * @returns {Promise<boolean>} - Whether login was successful
 */
export async function loginToXing(page, email, password) {
    if (!email || !password) {
        console.log('⚠️ Xing credentials not provided, skipping login');
        return false;
    }

    try {
        console.log('🔑 Logging in to Xing...');

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
            console.log('❌ Xing login failed - check credentials or handle CAPTCHA/2FA manually');
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
    } = options;

    const allProfiles = [];

    // Check if credentials are provided
    if (!xingEmail || !xingPassword) {
        console.log('⚠️ Xing credentials not provided. Skipping Xing scraping.');
        console.log('ℹ️  Add xingEmail and xingPassword to enable Xing scraping.');
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
                    // Perform login
                    const loginSuccess = await loginToXing(page, xingEmail, xingPassword);

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
