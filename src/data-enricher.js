/**
 * Data enrichment and deduplication module
 */

import {
    generateEmailPatterns,
    extractDomain,
    parseFullName,
    cleanCompanyName,
    formatGermanPhone,
    calculateEmailConfidence,
} from './utils.js';
import { findContactInfo, findPersonEmail } from './web-email-finder.js';
import { validateEmail } from './email-validator.js';

/**
 * Deduplicate leads based on multiple criteria
 * @param {Array<Object>} leads - Array of lead objects
 * @returns {Array<Object>} - Deduplicated leads
 */
export function deduplicateLeads(leads) {
    const uniqueLeads = new Map();

    for (const lead of leads) {
        // Create unique key based on email, LinkedIn URL, or name+company
        let key = null;

        if (lead.email) {
            key = `email:${lead.email.toLowerCase()}`;
        } else if (lead.linkedInUrl) {
            key = `linkedin:${lead.linkedInUrl}`;
        } else if (lead.xingUrl) {
            key = `xing:${lead.xingUrl}`;
        } else if (lead.name && lead.company) {
            key = `name:${lead.name.toLowerCase()}_${lead.company.toLowerCase()}`;
        } else {
            // Skip leads without sufficient identifying information
            continue;
        }

        // If we've seen this lead before, merge the data
        if (uniqueLeads.has(key)) {
            const existing = uniqueLeads.get(key);
            uniqueLeads.set(key, mergeLead(existing, lead));
        } else {
            uniqueLeads.set(key, lead);
        }
    }

    return Array.from(uniqueLeads.values());
}

/**
 * Merge two lead objects, preferring more complete data
 * @param {Object} lead1 - First lead
 * @param {Object} lead2 - Second lead
 * @returns {Object} - Merged lead
 */
export function mergeLead(lead1, lead2) {
    const merged = { ...lead1 };

    // Merge each field, preferring non-null values
    for (const key of Object.keys(lead2)) {
        if (lead2[key] && !lead1[key]) {
            merged[key] = lead2[key];
        }
    }

    // Combine sources
    const sources = new Set([
        ...(lead1.source ? lead1.source.split(',') : []),
        ...(lead2.source ? lead2.source.split(',') : []),
    ]);
    merged.source = Array.from(sources).join(',');

    // Keep the highest confidence email
    if (lead1.emailConfidence && lead2.emailConfidence) {
        const confidenceLevels = { verified: 4, high: 3, medium: 2, low: 1 };
        const conf1 = confidenceLevels[lead1.emailConfidence] || 0;
        const conf2 = confidenceLevels[lead2.emailConfidence] || 0;

        if (conf2 > conf1) {
            merged.email = lead2.email;
            merged.emailConfidence = lead2.emailConfidence;
        }
    }

    return merged;
}

/**
 * Enrich a single lead with additional data
 * @param {Object} lead - Lead object
 * @param {Object} options - Enrichment options
 * @returns {Promise<Object>} - Enriched lead
 */
export async function enrichLead(lead, options = {}) {
    const {
        findEmail = true,
        verifyEmail = false,
        findPhone = true,
    } = options;

    const enriched = { ...lead };

    // Clean company name
    if (enriched.company) {
        enriched.company = cleanCompanyName(enriched.company);
    }

    // Parse name into first and last if needed
    if (enriched.name && !enriched.firstName) {
        const { firstName, lastName } = parseFullName(enriched.name);
        enriched.firstName = firstName;
        enriched.lastName = lastName;
    }

    // Try to find email if not present
    if (findEmail && !enriched.email) {
        try {
            // Strategy 1: Generate email patterns if we have company website
            if (enriched.companyWebsite && enriched.firstName && enriched.lastName) {
                const domain = extractDomain(enriched.companyWebsite, enriched.company);
                if (domain) {
                    const patterns = generateEmailPatterns(enriched.firstName, enriched.lastName, domain);
                    if (patterns.length > 0) {
                        enriched.possibleEmails = patterns;
                        enriched.email = patterns[0]; // Use most common pattern
                        enriched.emailConfidence = 'medium';
                        enriched.emailSource = 'generated';
                    }
                }
            }

            // Strategy 2: Search web for email
            if (!enriched.email && enriched.name && enriched.company) {
                console.log(`Searching for email: ${enriched.name} at ${enriched.company}`);
                const emailResult = await findPersonEmail({
                    name: enriched.name,
                    firstName: enriched.firstName,
                    lastName: enriched.lastName,
                    company: enriched.company,
                    companyWebsite: enriched.companyWebsite,
                    jobTitle: enriched.jobTitle,
                });

                if (emailResult.emails && emailResult.emails.length > 0) {
                    enriched.email = emailResult.emails[0];
                    enriched.emailConfidence = emailResult.confidence;
                    enriched.emailSource = 'found';
                    enriched.possibleEmails = emailResult.emails;
                }
            }
        } catch (error) {
            console.log(`Email enrichment failed for ${lead.name}: ${error.message}`);
        }
    }

    // Verify email if requested
    if (verifyEmail && enriched.email) {
        try {
            const validation = await validateEmail(enriched.email, {
                checkMX: true,
                allowFreeProviders: false,
            });

            if (validation.isValid) {
                enriched.emailConfidence = 'verified';
            } else {
                // Email is invalid, remove it
                enriched.email = null;
                enriched.emailConfidence = null;
            }
        } catch (error) {
            console.log(`Email verification failed: ${error.message}`);
        }
    }

    // Find contact info from company website
    if (findPhone && enriched.companyWebsite && !enriched.phone) {
        try {
            const contactInfo = await findContactInfo(enriched.companyWebsite);

            if (contactInfo.phones && contactInfo.phones.length > 0) {
                enriched.phone = formatGermanPhone(contactInfo.phones[0]);
            }

            // If we found emails on the company site, add them as possible emails
            if (contactInfo.emails && contactInfo.emails.length > 0) {
                enriched.companyEmails = contactInfo.emails;
            }
        } catch (error) {
            console.log(`Contact info search failed: ${error.message}`);
        }
    }

    // Add timestamp
    enriched.scrapedAt = new Date().toISOString();

    return enriched;
}

/**
 * Enrich multiple leads in batch
 * @param {Array<Object>} leads - Array of leads
 * @param {Object} options - Enrichment options
 * @returns {Promise<Array<Object>>} - Enriched leads
 */
export async function enrichLeadsBatch(leads, options = {}) {
    const enrichedLeads = [];

    for (const lead of leads) {
        try {
            const enriched = await enrichLead(lead, options);
            enrichedLeads.push(enriched);
        } catch (error) {
            console.log(`Failed to enrich lead ${lead.name}: ${error.message}`);
            enrichedLeads.push(lead); // Add original if enrichment fails
        }
    }

    return enrichedLeads;
}

/**
 * Score lead quality based on data completeness
 * @param {Object} lead - Lead object
 * @returns {Object} - Lead with quality score
 */
export function scoreLead(lead) {
    const scored = { ...lead };
    let score = 0;
    const maxScore = 100;

    // Email (most important)
    if (scored.email) {
        if (scored.emailConfidence === 'verified') score += 40;
        else if (scored.emailConfidence === 'high') score += 30;
        else if (scored.emailConfidence === 'medium') score += 20;
        else score += 10;
    }

    // Phone
    if (scored.phone) score += 15;

    // Job title
    if (scored.jobTitle) score += 10;

    // Company info
    if (scored.company) score += 10;
    if (scored.companyWebsite) score += 10;

    // Location
    if (scored.location) score += 5;

    // Social profiles
    if (scored.linkedInUrl) score += 5;
    if (scored.xingUrl) score += 5;

    scored.qualityScore = Math.min(score, maxScore);

    return scored;
}

/**
 * Filter leads by quality score
 * @param {Array<Object>} leads - Array of leads
 * @param {number} minScore - Minimum quality score (0-100)
 * @returns {Array<Object>} - Filtered leads
 */
export function filterByQuality(leads, minScore = 50) {
    return leads
        .map(lead => scoreLead(lead))
        .filter(lead => lead.qualityScore >= minScore)
        .sort((a, b) => b.qualityScore - a.qualityScore);
}

/**
 * Normalize lead data to standard format
 * @param {Object} lead - Raw lead data
 * @param {string} source - Source of the lead
 * @returns {Object} - Normalized lead
 */
export function normalizeLead(lead, source) {
    return {
        name: lead.name || lead.fullName || null,
        firstName: lead.firstName || null,
        lastName: lead.lastName || null,
        jobTitle: lead.jobTitle || lead.headline || lead.title || null,
        company: lead.company || lead.companyName || null,
        location: lead.location || null,
        email: lead.email || null,
        emailConfidence: lead.emailConfidence || calculateEmailConfidence(lead.email, lead.emailSource),
        phone: lead.phone ? formatGermanPhone(lead.phone) : null,
        linkedInUrl: lead.linkedInUrl || lead.linkedin || null,
        xingUrl: lead.xingUrl || lead.xing || null,
        companyWebsite: lead.companyWebsite || lead.website || null,
        companySize: lead.companySize || null,
        industry: lead.industry || null,
        source: source,
        scrapedAt: lead.scrapedAt || new Date().toISOString(),
    };
}

/**
 * Process and enrich all leads
 * @param {Array<Object>} rawLeads - Raw leads from multiple sources
 * @param {Object} options - Processing options
 * @returns {Promise<Array<Object>>} - Processed leads
 */
export async function processLeads(rawLeads, options = {}) {
    const {
        deduplicate = true,
        enrich = true,
        minQualityScore = 30,
        verifyEmail = false,
    } = options;

    console.log(`Processing ${rawLeads.length} raw leads...`);

    // Step 1: Normalize all leads
    let leads = rawLeads;

    // Step 2: Deduplicate
    if (deduplicate) {
        leads = deduplicateLeads(leads);
        console.log(`After deduplication: ${leads.length} leads`);
    }

    // Step 3: Enrich
    if (enrich) {
        leads = await enrichLeadsBatch(leads, {
            findEmail: true,
            verifyEmail: verifyEmail,
            findPhone: true,
        });
        console.log(`After enrichment: ${leads.length} leads`);
    }

    // Step 4: Score and filter
    leads = filterByQuality(leads, minQualityScore);
    console.log(`After quality filtering (min score ${minQualityScore}): ${leads.length} leads`);

    return leads;
}
