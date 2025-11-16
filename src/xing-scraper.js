/**
 * Xing scraper module for German B2B market
 * Searches for IT decision makers on Xing
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import {
    generateEmailPatterns,
    extractDomain,
    parseFullName,
    randomDelay,
    getRandomUserAgent,
    extractEmailsFromText,
} from './utils.js';

/**
 * Generate Xing search URLs
 * @param {string} jobTitle - Job title
 * @param {string} location - Location
 * @returns {string} - Xing search URL
 */
export function generateXingSearchUrl(jobTitle, location) {
    const keywords = `${jobTitle} ${location}`.trim();
    return `https://www.xing.com/search/members?keywords=${encodeURIComponent(keywords)}`;
}

/**
 * Search for profiles on Xing
 * @param {string} jobTitle - Job title
 * @param {string} location - Location
 * @param {Object} options - Search options
 * @returns {Promise<Array<Object>>} - Found profiles
 */
export async function searchXingProfiles(jobTitle, location, options = {}) {
    const {
        maxResults = 50,
    } = options;

    const searchUrl = generateXingSearchUrl(jobTitle, location);
    const profiles = [];

    try {
        console.log(`Searching Xing: ${searchUrl}`);

        await randomDelay(2000, 4000);

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'de,en;q=0.5',
            },
            timeout: 15000,
        });

        const $ = cheerio.load(response.data);

        // Extract profile information from search results
        // Note: Xing's structure may change, this is a basic implementation
        $('.search-result-item, .profile-mini-profile').each((index, element) => {
            if (profiles.length >= maxResults) return false;

            const $elem = $(element);

            const profile = {
                name: null,
                jobTitle: null,
                company: null,
                location: null,
                xingUrl: null,
                source: 'xing',
            };

            // Try to extract name
            profile.name = $elem.find('.name, .profile-name').text().trim() ||
                          $elem.find('a[title]').attr('title') ||
                          null;

            // Try to extract job title
            profile.jobTitle = $elem.find('.occupation, .job-title').text().trim() || null;

            // Try to extract company
            profile.company = $elem.find('.company, .company-name').text().trim() || null;

            // Try to extract location
            profile.location = $elem.find('.location').text().trim() || null;

            // Try to extract profile URL
            const profileLink = $elem.find('a[href*="/profile/"]').attr('href');
            if (profileLink) {
                profile.xingUrl = profileLink.startsWith('http') ? profileLink : `https://www.xing.com${profileLink}`;
            }

            if (profile.name) {
                profiles.push(profile);
            }
        });

        console.log(`Found ${profiles.length} profiles on Xing`);

    } catch (error) {
        console.log(`Xing search error: ${error.message}`);

        // Return search URL for manual use if automated search fails
        return [{
            source: 'xing_search_url',
            url: searchUrl,
            note: 'Use this URL to manually search Xing (login may be required)',
        }];
    }

    return profiles;
}

/**
 * Scrape a public Xing profile
 * @param {string} profileUrl - Xing profile URL
 * @returns {Promise<Object|null>} - Profile information
 */
export async function scrapeXingProfile(profileUrl) {
    try {
        await randomDelay(2000, 4000);

        const response = await axios.get(profileUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'de,en;q=0.5',
            },
            timeout: 15000,
        });

        const $ = cheerio.load(response.data);

        const profile = {
            name: null,
            jobTitle: null,
            company: null,
            location: null,
            xingUrl: profileUrl,
            companyWebsite: null,
        };

        // Extract from meta tags
        profile.name = $('meta[property="og:title"]').attr('content') || null;

        // Try to extract job title from description
        const description = $('meta[property="og:description"]').attr('content');
        if (description) {
            const parts = description.split('bei');
            if (parts.length >= 2) {
                profile.jobTitle = parts[0].trim();
                profile.company = parts[1].trim();
            }
        }

        // Try to extract company website
        const companyLink = $('a[href*="company"]').attr('href');
        if (companyLink) {
            profile.companyWebsite = await scrapeXingCompanyWebsite(companyLink);
        }

        return profile;

    } catch (error) {
        console.log(`Failed to scrape Xing profile ${profileUrl}: ${error.message}`);
        return null;
    }
}

/**
 * Scrape Xing company page for website URL
 * @param {string} companyUrl - Xing company page URL
 * @returns {Promise<string|null>} - Company website URL
 */
export async function scrapeXingCompanyWebsite(companyUrl) {
    try {
        await randomDelay(1000, 2000);

        const response = await axios.get(companyUrl, {
            headers: {
                'User-Agent': getRandomUserAgent(),
            },
            timeout: 10000,
        });

        const $ = cheerio.load(response.data);

        // Look for website link
        const website = $('a[rel="nofollow external"]').attr('href') ||
                       $('a.company-website').attr('href') ||
                       null;

        return website;

    } catch (error) {
        console.log(`Failed to scrape Xing company page: ${error.message}`);
        return null;
    }
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

    // Generate email patterns if we have company website
    const website = companyWebsite || profile.companyWebsite;
    if (website) {
        const domain = extractDomain(website, profile.company);
        if (domain) {
            enriched.possibleEmails = generateEmailPatterns(firstName, lastName, domain);
            enriched.emailConfidence = 'medium';
        }
    } else if (profile.company) {
        // Try to guess domain from company name
        const domain = extractDomain(null, profile.company);
        if (domain) {
            enriched.possibleEmails = generateEmailPatterns(firstName, lastName, domain);
            enriched.emailConfidence = 'low';
        }
    }

    return enriched;
}

/**
 * Find IT decision makers on Xing
 * @param {Array<string>} jobTitles - Job titles to search for
 * @param {Array<string>} locations - Locations to search in
 * @param {Object} options - Search options
 * @returns {Promise<Array<Object>>} - Found profiles
 */
export async function findITDecisionMakersXing(jobTitles, locations, options = {}) {
    const {
        maxLeadsPerSearch = 50,
    } = options;

    const allProfiles = [];

    for (const jobTitle of jobTitles) {
        for (const location of locations) {
            const profiles = await searchXingProfiles(jobTitle, location, {
                maxResults: maxLeadsPerSearch,
            });

            allProfiles.push(...profiles);
            await randomDelay(3000, 5000);
        }
    }

    return allProfiles;
}

/**
 * Search for company employees on Xing
 * @param {string} companyName - Company name
 * @param {Array<string>} jobTitles - Job titles to search for
 * @returns {Promise<Array<Object>>} - Found profiles
 */
export async function searchXingCompanyEmployees(companyName, jobTitles = []) {
    const profiles = [];

    for (const jobTitle of jobTitles) {
        const keywords = `${jobTitle} ${companyName}`;
        const searchUrl = `https://www.xing.com/search/members?keywords=${encodeURIComponent(keywords)}`;

        try {
            await randomDelay(2000, 4000);

            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': getRandomUserAgent(),
                },
                timeout: 15000,
            });

            const $ = cheerio.load(response.data);

            // Extract profiles (similar to searchXingProfiles)
            $('.search-result-item').each((_, element) => {
                const $elem = $(element);

                const profile = {
                    name: $elem.find('.name').text().trim(),
                    jobTitle: $elem.find('.occupation').text().trim(),
                    company: companyName,
                    source: 'xing',
                };

                if (profile.name) {
                    profiles.push(profile);
                }
            });

        } catch (error) {
            console.log(`Xing company search error: ${error.message}`);
        }
    }

    return profiles;
}
