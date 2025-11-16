/**
 * LinkedIn scraper module with login support
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
 * Login to LinkedIn
 * @param {Page} page - Playwright page
 * @param {string} email - LinkedIn email
 * @param {string} password - LinkedIn password
 * @returns {Promise<boolean>} - Whether login was successful
 */
export async function loginToLinkedIn(page, email, password) {
    if (!email || !password) {
        console.log('⚠️ LinkedIn credentials not provided, skipping login');
        return false;
    }

    try {
        console.log('🔑 Logging in to LinkedIn...');

        await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle' });
        await randomDelay(2000, 3000);

        // Fill in credentials
        await page.fill('input[name="session_key"]', email);
        await page.fill('input[name="session_password"]', password);

        await randomDelay(1000, 2000);

        // Click login button
        await page.click('button[type="submit"]');

        await randomDelay(5000, 7000);

        // Check if login was successful
        const isLoggedIn = await page.evaluate(() => {
            return !window.location.href.includes('/login') &&
                   !window.location.href.includes('/checkpoint');
        });

        if (isLoggedIn) {
            console.log('✅ LinkedIn login successful');
            return true;
        } else {
            console.log('❌ LinkedIn login failed - check credentials or handle CAPTCHA/2FA manually');
            return false;
        }

    } catch (error) {
        console.log(`LinkedIn login error: ${error.message}`);
        return false;
    }
}

/**
 * Search for profiles on LinkedIn
 * @param {Page} page - Playwright page
 * @param {string} jobTitle - Job title to search
 * @param {string} location - Location
 * @param {number} maxResults - Maximum results
 * @returns {Promise<Array<Object>>} - Found profiles
 */
export async function searchLinkedInProfiles(page, jobTitle, location, maxResults = 50) {
    const profiles = [];

    try {
        const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(jobTitle + ' ' + location)}&origin=SWITCH_SEARCH_VERTICAL`;

        console.log(`🔍 Searching LinkedIn: ${jobTitle} in ${location}`);

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
            const items = document.querySelectorAll('.reusable-search__result-container');

            items.forEach(item => {
                try {
                    const nameElement = item.querySelector('.entity-result__title-text a span[aria-hidden="true"]');
                    const titleElement = item.querySelector('.entity-result__primary-subtitle');
                    const locationElement = item.querySelector('.entity-result__secondary-subtitle');
                    const linkElement = item.querySelector('.entity-result__title-text a');

                    const profile = {
                        name: nameElement?.textContent?.trim() || null,
                        jobTitle: titleElement?.textContent?.trim() || null,
                        location: locationElement?.textContent?.trim() || null,
                        linkedInUrl: linkElement?.href || null,
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
        console.log(`✅ Found ${profiles.length} profiles on LinkedIn`);

    } catch (error) {
        console.log(`LinkedIn search error: ${error.message}`);
    }

    return profiles;
}

/**
 * Scrape detailed profile information
 * @param {Page} page - Playwright page
 * @param {string} profileUrl - LinkedIn profile URL
 * @returns {Promise<Object|null>} - Profile details
 */
export async function scrapeLinkedInProfile(page, profileUrl) {
    try {
        await page.goto(profileUrl, { waitUntil: 'networkidle' });
        await randomDelay(3000, 5000);

        const profileData = await page.evaluate(() => {
            const data = {
                name: null,
                jobTitle: null,
                company: null,
                location: null,
                about: null,
            };

            // Extract name
            const nameElement = document.querySelector('h1.text-heading-xlarge');
            data.name = nameElement?.textContent?.trim() || null;

            // Extract current position
            const titleElement = document.querySelector('.text-body-medium.break-words');
            data.jobTitle = titleElement?.textContent?.trim() || null;

            // Extract location
            const locationElement = document.querySelector('.text-body-small.inline.t-black--light.break-words');
            data.location = locationElement?.textContent?.trim() || null;

            // Extract company from experience section
            const companyElement = document.querySelector('#experience + div .display-flex.flex-column.full-width .t-bold span[aria-hidden="true"]');
            data.company = companyElement?.textContent?.trim() || null;

            // Extract about section
            const aboutElement = document.querySelector('#about + div .display-flex.full-width');
            data.about = aboutElement?.textContent?.trim() || null;

            return data;
        });

        return profileData;

    } catch (error) {
        console.log(`Failed to scrape profile ${profileUrl}: ${error.message}`);
        return null;
    }
}

/**
 * Find IT decision makers on LinkedIn with login
 * @param {Array<string>} jobTitles - Job titles
 * @param {Array<string>} locations - Locations
 * @param {Object} options - Options
 * @returns {Promise<Array<Object>>} - Found profiles
 */
export async function findITDecisionMakers(jobTitles, locations, options = {}) {
    const {
        maxLeadsPerSearch = 50,
        linkedInEmail = null,
        linkedInPassword = null,
        proxyConfiguration = {},
    } = options;

    const allProfiles = [];

    // Check if credentials are provided
    if (!linkedInEmail || !linkedInPassword) {
        console.log('⚠️ LinkedIn credentials not provided. Skipping LinkedIn scraping.');
        console.log('ℹ️  Add linkedInEmail and linkedInPassword to enable LinkedIn scraping.');
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
                const { jobTitle, location, isLogin } = request.userData;

                if (isLogin) {
                    // Perform login
                    const loginSuccess = await loginToLinkedIn(page, linkedInEmail, linkedInPassword);

                    if (!loginSuccess) {
                        throw new Error('LinkedIn login failed');
                    }

                    // After login, search for profiles
                    for (const title of jobTitles) {
                        for (const loc of locations) {
                            const profiles = await searchLinkedInProfiles(page, title, loc, maxLeadsPerSearch);

                            // Enrich profiles with email patterns
                            for (const profile of profiles) {
                                const enriched = enrichLinkedInProfile(profile);
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
                url: 'https://www.linkedin.com/login',
                userData: { isLogin: true },
            },
        ]);

    } catch (error) {
        console.log(`LinkedIn scraping error: ${error.message}`);
    }

    return allProfiles;
}

/**
 * Enrich LinkedIn profile data with email patterns
 * @param {Object} profile - LinkedIn profile
 * @param {string} companyWebsite - Company website
 * @returns {Object} - Enriched profile with email patterns
 */
export function enrichLinkedInProfile(profile, companyWebsite = null) {
    const enriched = { ...profile };

    if (!profile.name) {
        return enriched;
    }

    const { firstName, lastName } = parseFullName(profile.name);
    enriched.firstName = firstName;
    enriched.lastName = lastName;

    // Generate email patterns if we have company info
    if (companyWebsite || profile.company) {
        const domain = extractDomain(companyWebsite, profile.company);
        if (domain) {
            enriched.possibleEmails = generateEmailPatterns(firstName, lastName, domain);
            enriched.emailConfidence = companyWebsite ? 'medium' : 'low';
        }
    }

    enriched.source = 'linkedin';

    return enriched;
}
