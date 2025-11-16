/**
 * LinkedIn scraper module
 * Uses Apify's LinkedIn scraper actors or public profile data
 */

import { ApifyClient } from 'apify-client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
    generateEmailPatterns,
    extractDomain,
    parseFullName,
    randomDelay,
    getRandomUserAgent,
} from './utils.js';

/**
 * Search LinkedIn profiles using Apify's LinkedIn scraper
 * Note: This requires Apify LinkedIn scraper actor and potentially LinkedIn login credentials
 * @param {string} jobTitle - Job title to search for
 * @param {string} location - Location to search in
 * @param {Object} options - Search options
 * @returns {Promise<Array<Object>>} - Array of LinkedIn profiles
 */
export async function searchLinkedInProfiles(jobTitle, location, options = {}) {
    const {
        maxResults = 50,
        apifyClient = null,
    } = options;

    if (!apifyClient) {
        console.log('LinkedIn scraping requires Apify client with API token');
        return [];
    }

    try {
        // Use Apify's LinkedIn People Search Actor
        // Actor ID: apify/linkedin-people-scraper or similar
        const actorId = 'apify/linkedin-people-scraper';

        const input = {
            searchUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(jobTitle)}&location=${encodeURIComponent(location)}`,
            maxResults: maxResults,
        };

        console.log(`Running LinkedIn scraper for: ${jobTitle} in ${location}`);

        const run = await apifyClient.actor(actorId).call(input);
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

        return items.map(item => ({
            name: item.name || item.fullName,
            jobTitle: item.headline || item.title,
            company: item.company,
            location: item.location,
            linkedInUrl: item.url || item.profileUrl,
            profilePicture: item.photo || item.profilePicture,
            summary: item.summary,
        }));

    } catch (error) {
        console.log(`LinkedIn scraping error: ${error.message}`);
        return [];
    }
}

/**
 * Extract information from a public LinkedIn profile URL
 * Note: This only works for public profiles without login
 * @param {string} profileUrl - LinkedIn profile URL
 * @returns {Promise<Object|null>} - Profile information
 */
export async function scrapePublicLinkedInProfile(profileUrl) {
    try {
        // Add delay to avoid rate limiting
        await randomDelay(2000, 4000);

        const response = await axios.get(profileUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
            },
            timeout: 15000,
        });

        const $ = cheerio.load(response.data);

        // Try to extract basic information from public profile
        // Note: LinkedIn's HTML structure changes frequently
        const profile = {
            name: null,
            jobTitle: null,
            company: null,
            location: null,
            linkedInUrl: profileUrl,
        };

        // Extract from meta tags (more reliable for public profiles)
        profile.name = $('meta[property="og:title"]').attr('content') || null;
        profile.jobTitle = $('meta[property="og:description"]').attr('content')?.split('·')[0]?.trim() || null;

        // Try to extract from JSON-LD schema
        const jsonLd = $('script[type="application/ld+json"]').html();
        if (jsonLd) {
            try {
                const data = JSON.parse(jsonLd);
                if (data['@type'] === 'Person') {
                    profile.name = data.name || profile.name;
                    profile.jobTitle = data.jobTitle || profile.jobTitle;
                    profile.company = data.worksFor?.name || null;
                }
            } catch (e) {
                // JSON parsing failed
            }
        }

        return profile;

    } catch (error) {
        console.log(`Failed to scrape LinkedIn profile ${profileUrl}: ${error.message}`);
        return null;
    }
}

/**
 * Generate LinkedIn search URLs for manual scraping
 * @param {string} jobTitle - Job title
 * @param {string} location - Location
 * @param {string} company - Company name (optional)
 * @returns {Array<string>} - LinkedIn search URLs
 */
export function generateLinkedInSearchUrls(jobTitle, location, company = null) {
    const baseUrl = 'https://www.linkedin.com/search/results/people/';
    const urls = [];

    // Basic search
    const params1 = new URLSearchParams({
        keywords: jobTitle,
        origin: 'SWITCH_SEARCH_VERTICAL',
    });
    urls.push(`${baseUrl}?${params1.toString()}`);

    // With location
    const params2 = new URLSearchParams({
        keywords: `${jobTitle} ${location}`,
        origin: 'SWITCH_SEARCH_VERTICAL',
    });
    urls.push(`${baseUrl}?${params2.toString()}`);

    // With company
    if (company) {
        const params3 = new URLSearchParams({
            keywords: `${jobTitle} ${company}`,
            origin: 'SWITCH_SEARCH_VERTICAL',
        });
        urls.push(`${baseUrl}?${params3.toString()}`);
    }

    return urls;
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

    // Generate email patterns if we have company website
    if (companyWebsite) {
        const domain = extractDomain(companyWebsite, profile.company);
        if (domain) {
            enriched.possibleEmails = generateEmailPatterns(firstName, lastName, domain);
            enriched.emailConfidence = 'medium'; // Pattern-based
        }
    } else if (profile.company) {
        // Try to guess domain from company name
        const domain = extractDomain(null, profile.company);
        if (domain) {
            enriched.possibleEmails = generateEmailPatterns(firstName, lastName, domain);
            enriched.emailConfidence = 'low'; // Guessed domain
        }
    }

    return enriched;
}

/**
 * Search for IT decision makers on LinkedIn
 * @param {Array<string>} jobTitles - Job titles to search for
 * @param {Array<string>} locations - Locations to search in
 * @param {Object} options - Search options
 * @returns {Promise<Array<Object>>} - Found profiles
 */
export async function findITDecisionMakers(jobTitles, locations, options = {}) {
    const {
        maxLeadsPerSearch = 50,
        apifyClient = null,
        useApifyActor = false,
    } = options;

    const allProfiles = [];

    // If using Apify Actor
    if (useApifyActor && apifyClient) {
        for (const jobTitle of jobTitles) {
            for (const location of locations) {
                const profiles = await searchLinkedInProfiles(jobTitle, location, {
                    maxResults: maxLeadsPerSearch,
                    apifyClient,
                });

                allProfiles.push(...profiles);
                await randomDelay(3000, 5000);
            }
        }
    } else {
        // Return search URLs for manual use or external scraping
        console.log('LinkedIn Actor not configured. Generating search URLs...');

        const searchUrls = [];
        for (const jobTitle of jobTitles) {
            for (const location of locations) {
                const urls = generateLinkedInSearchUrls(jobTitle, location);
                searchUrls.push(...urls);
            }
        }

        console.log(`Generated ${searchUrls.length} LinkedIn search URLs`);
        return searchUrls.map(url => ({
            source: 'linkedin_search_url',
            url,
            note: 'Use this URL to manually search LinkedIn or with LinkedIn scraper actor',
        }));
    }

    return allProfiles;
}

/**
 * Extract company information from LinkedIn company page
 * @param {string} companyUrl - LinkedIn company page URL
 * @returns {Promise<Object|null>} - Company information
 */
export async function scrapeLinkedInCompany(companyUrl) {
    try {
        await randomDelay(2000, 4000);

        const response = await axios.get(companyUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
            },
            timeout: 15000,
        });

        const $ = cheerio.load(response.data);

        const company = {
            name: $('meta[property="og:title"]').attr('content') || null,
            description: $('meta[property="og:description"]').attr('content') || null,
            website: null,
            industry: null,
            size: null,
        };

        return company;

    } catch (error) {
        console.log(`Failed to scrape LinkedIn company ${companyUrl}: ${error.message}`);
        return null;
    }
}
