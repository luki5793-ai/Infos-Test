/**
 * Web-based email finder module
 * Searches company websites and web for email addresses
 */

import { CheerioCrawler } from 'crawlee';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
    extractEmailsFromText,
    extractDomain,
    isValidUrl,
    randomDelay,
    getRandomUserAgent,
    sanitizeSearchQuery,
} from './utils.js';

/**
 * Search Google for person and company information
 * @param {string} name - Person's name
 * @param {string} company - Company name
 * @param {string} jobTitle - Job title
 * @returns {Promise<Array<string>>} - Array of URLs to check
 */
export async function searchWebForPerson(name, company, jobTitle) {
    const queries = [
        `"${name}" "${company}" email kontakt`,
        `"${name}" "${company}" "${jobTitle}"`,
        `"${name}" ${company} impressum`,
    ];

    const urls = new Set();

    for (const query of queries) {
        try {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(sanitizeSearchQuery(query))}&num=10`;

            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': getRandomUserAgent(),
                },
                timeout: 10000,
            });

            const $ = cheerio.load(response.data);

            // Extract URLs from search results
            $('a').each((_, element) => {
                const href = $(element).attr('href');
                if (href && href.startsWith('http') && !href.includes('google.com')) {
                    urls.add(href);
                }
            });

            await randomDelay(3000, 5000);
        } catch (error) {
            console.log(`Web search failed for query "${query}": ${error.message}`);
        }
    }

    return Array.from(urls).slice(0, 20); // Limit to 20 URLs
}

/**
 * Crawl company website for email addresses
 * @param {string} websiteUrl - Company website URL
 * @param {string} personName - Person's name to look for
 * @returns {Promise<Array<string>>} - Found email addresses
 */
export async function crawlCompanyWebsite(websiteUrl, personName = '') {
    if (!isValidUrl(websiteUrl)) {
        return [];
    }

    const foundEmails = new Set();
    const visitedUrls = new Set();

    try {
        const domain = new URL(websiteUrl).hostname;

        // Priority pages to check
        const priorityPages = [
            websiteUrl,
            `${websiteUrl}/impressum`,
            `${websiteUrl}/imprint`,
            `${websiteUrl}/kontakt`,
            `${websiteUrl}/contact`,
            `${websiteUrl}/about`,
            `${websiteUrl}/team`,
            `${websiteUrl}/ueber-uns`,
        ];

        for (const url of priorityPages) {
            if (visitedUrls.has(url)) continue;

            try {
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': getRandomUserAgent(),
                    },
                    timeout: 10000,
                    maxRedirects: 5,
                });

                visitedUrls.add(url);

                const $ = cheerio.load(response.data);

                // Extract emails from text content
                const pageText = $('body').text();
                const emails = extractEmailsFromText(pageText);

                // Filter emails from the same domain
                emails.forEach(email => {
                    const emailDomain = email.split('@')[1];
                    if (emailDomain && emailDomain.includes(domain.replace('www.', ''))) {
                        foundEmails.add(email);
                    }
                });

                // Look for mailto links
                $('a[href^="mailto:"]').each((_, element) => {
                    const mailto = $(element).attr('href');
                    if (mailto) {
                        const email = mailto.replace('mailto:', '').split('?')[0];
                        if (email) foundEmails.add(email);
                    }
                });

                await randomDelay(1000, 2000);
            } catch (error) {
                console.log(`Failed to crawl ${url}: ${error.message}`);
            }
        }
    } catch (error) {
        console.log(`Website crawling error: ${error.message}`);
    }

    return Array.from(foundEmails);
}

/**
 * Find email on company's contact/impressum page
 * @param {string} companyWebsite - Company website URL
 * @returns {Promise<Object>} - Found contact information
 */
export async function findContactInfo(companyWebsite) {
    const result = {
        emails: [],
        phones: [],
        address: null,
    };

    if (!companyWebsite || !isValidUrl(companyWebsite)) {
        return result;
    }

    try {
        const emails = await crawlCompanyWebsite(companyWebsite);
        result.emails = emails;

        // Try to find phone numbers and address
        const impressumUrls = [
            `${companyWebsite}/impressum`,
            `${companyWebsite}/imprint`,
            `${companyWebsite}/kontakt`,
        ];

        for (const url of impressumUrls) {
            try {
                const response = await axios.get(url, {
                    headers: { 'User-Agent': getRandomUserAgent() },
                    timeout: 10000,
                });

                const $ = cheerio.load(response.data);
                const pageText = $('body').text();

                // Extract phone numbers (German format)
                const phoneRegex = /(\+49|0)[1-9]\d{1,4}[\s\-\/]?\d{1,8}/g;
                const phones = pageText.match(phoneRegex) || [];
                result.phones = [...new Set(phones)];

                break; // Stop after first successful page
            } catch (error) {
                // Continue to next URL
            }
        }
    } catch (error) {
        console.log(`Contact info search failed: ${error.message}`);
    }

    return result;
}

/**
 * Search for person's email using multiple strategies
 * @param {Object} person - Person information
 * @param {string} person.name - Full name
 * @param {string} person.firstName - First name
 * @param {string} person.lastName - Last name
 * @param {string} person.company - Company name
 * @param {string} person.companyWebsite - Company website
 * @param {string} person.jobTitle - Job title
 * @returns {Promise<Object>} - Search results
 */
export async function findPersonEmail(person) {
    const result = {
        emails: [],
        confidence: 'low',
        source: 'web',
    };

    try {
        // Strategy 1: Crawl company website
        if (person.companyWebsite) {
            console.log(`Crawling company website: ${person.companyWebsite}`);
            const websiteEmails = await crawlCompanyWebsite(person.companyWebsite, person.name);

            if (websiteEmails.length > 0) {
                result.emails = websiteEmails;
                result.confidence = 'high';
                return result;
            }
        }

        // Strategy 2: Web search for person
        if (person.name && person.company) {
            console.log(`Searching web for: ${person.name} at ${person.company}`);
            const searchUrls = await searchWebForPerson(person.name, person.company, person.jobTitle);

            // Check first few URLs for email addresses
            for (const url of searchUrls.slice(0, 5)) {
                try {
                    const response = await axios.get(url, {
                        headers: { 'User-Agent': getRandomUserAgent() },
                        timeout: 8000,
                    });

                    const pageText = response.data;
                    const emails = extractEmailsFromText(pageText);

                    // Check if person's name is on the page with email
                    if (emails.length > 0 && pageText.includes(person.name)) {
                        result.emails = emails;
                        result.confidence = 'medium';
                        break;
                    }

                    await randomDelay(2000, 3000);
                } catch (error) {
                    // Continue to next URL
                }
            }
        }
    } catch (error) {
        console.log(`Email finding error: ${error.message}`);
    }

    return result;
}

/**
 * Extract company information from website
 * @param {string} websiteUrl - Company website URL
 * @returns {Promise<Object>} - Company information
 */
export async function extractCompanyInfo(websiteUrl) {
    const info = {
        name: null,
        industry: null,
        size: null,
        description: null,
    };

    if (!websiteUrl || !isValidUrl(websiteUrl)) {
        return info;
    }

    try {
        const response = await axios.get(websiteUrl, {
            headers: { 'User-Agent': getRandomUserAgent() },
            timeout: 10000,
        });

        const $ = cheerio.load(response.data);

        // Try to extract company name
        info.name = $('title').text().split('-')[0].trim() ||
                    $('meta[property="og:site_name"]').attr('content') ||
                    null;

        // Try to extract description
        info.description = $('meta[name="description"]').attr('content') ||
                          $('meta[property="og:description"]').attr('content') ||
                          null;

    } catch (error) {
        console.log(`Company info extraction failed: ${error.message}`);
    }

    return info;
}
