/**
 * IT Decision Maker Lead Finder - Apify Actor
 * Main entry point
 */

import { Actor } from 'apify';
import { ApifyClient } from 'apify-client';
import pLimit from 'p-limit';

// Import modules
import { findITDecisionMakers, enrichLinkedInProfile } from './linkedin-scraper.js';
import { findITDecisionMakersXing, enrichXingProfile } from './xing-scraper.js';
import { findPersonEmail, crawlCompanyWebsite } from './web-email-finder.js';
import { validateEmail } from './email-validator.js';
import { processLeads, normalizeLead } from './data-enricher.js';
import { randomDelay } from './utils.js';

/**
 * Main actor function
 */
await Actor.main(async () => {
    console.log('🚀 Starting IT Decision Maker Lead Finder Actor');

    // Get input
    const input = await Actor.getInput();

    // Validate required fields
    if (!input.jobTitles || input.jobTitles.length === 0) {
        throw new Error('jobTitles is required and must contain at least one job title');
    }

    if (!input.locations || input.locations.length === 0) {
        throw new Error('locations is required and must contain at least one location');
    }

    // Extract configuration
    const {
        jobTitles,
        locations,
        companyNames = [],
        industrySectors = [],
        maxLeadsPerSearch = 50,
        enableLinkedInScraping = true,
        enableXingScraping = true,
        enableWebSearch = true,
        emailVerification = false,
        linkedInEmail = null,
        linkedInPassword = null,
        xingEmail = null,
        xingPassword = null,
        proxyConfiguration = {},
    } = input;

    console.log('📋 Configuration:');
    console.log(`  Job Titles: ${jobTitles.join(', ')}`);
    console.log(`  Locations: ${locations.join(', ')}`);
    console.log(`  Max Leads per Search: ${maxLeadsPerSearch}`);
    console.log(`  LinkedIn Scraping: ${enableLinkedInScraping}`);
    console.log(`  Xing Scraping: ${enableXingScraping}`);
    console.log(`  Web Search: ${enableWebSearch}`);
    console.log(`  Email Verification: ${emailVerification}`);

    // Initialize Apify client for sub-actors
    const apifyClient = process.env.APIFY_TOKEN
        ? new ApifyClient({ token: process.env.APIFY_TOKEN })
        : null;

    // Store for all collected leads
    const allLeads = [];

    // Concurrency limiter
    const limit = pLimit(5); // Max 5 concurrent operations

    // ===== PHASE 1: LinkedIn Scraping =====
    if (enableLinkedInScraping) {
        console.log('\n🔵 Phase 1: LinkedIn Scraping');

        try {
            const linkedInProfiles = await findITDecisionMakers(jobTitles, locations, {
                maxLeadsPerSearch,
                linkedInEmail,
                linkedInPassword,
                proxyConfiguration,
            });

            console.log(`Found ${linkedInProfiles.length} profiles on LinkedIn`);

            // Normalize and add to leads
            for (const profile of linkedInProfiles) {
                const normalized = normalizeLead(profile, 'linkedin');

                // Enrich with email patterns if we have company info
                if (normalized.company) {
                    const enriched = enrichLinkedInProfile(normalized, normalized.companyWebsite);
                    allLeads.push(enriched);
                } else {
                    allLeads.push(normalized);
                }
            }

            await Actor.setValue('linkedin_profiles', linkedInProfiles);
        } catch (error) {
            console.error(`LinkedIn scraping failed: ${error.message}`);
        }
    }

    // ===== PHASE 2: Xing Scraping =====
    if (enableXingScraping) {
        console.log('\n🟡 Phase 2: Xing Scraping');

        try {
            const xingProfiles = await findITDecisionMakersXing(jobTitles, locations, {
                maxLeadsPerSearch,
                xingEmail,
                xingPassword,
            });

            console.log(`Found ${xingProfiles.length} profiles on Xing`);

            // Normalize and add to leads
            for (const profile of xingProfiles) {
                const normalized = normalizeLead(profile, 'xing');

                // Enrich with email patterns
                if (normalized.company) {
                    const enriched = enrichXingProfile(normalized, normalized.companyWebsite);
                    allLeads.push(enriched);
                } else {
                    allLeads.push(normalized);
                }
            }

            await Actor.setValue('xing_profiles', xingProfiles);
        } catch (error) {
            console.error(`Xing scraping failed: ${error.message}`);
        }
    }

    // ===== PHASE 3: Company-Specific Search =====
    if (companyNames && companyNames.length > 0) {
        console.log('\n🏢 Phase 3: Company-Specific Search');

        for (const company of companyNames) {
            console.log(`Searching for leads at: ${company}`);

            // Search on LinkedIn
            if (enableLinkedInScraping) {
                // Use company-specific search
                // This would require additional implementation
            }

            // Search on Xing
            if (enableXingScraping) {
                // Similar to above
            }

            await randomDelay(2000, 3000);
        }
    }

    // ===== PHASE 4: Web Search for Emails =====
    if (enableWebSearch) {
        console.log('\n🌐 Phase 4: Web Search for Emails');
        console.log(`Searching for emails for ${allLeads.length} leads...`);

        // For leads without email, try web search
        const leadsWithoutEmail = allLeads.filter(lead => !lead.email);
        console.log(`${leadsWithoutEmail.length} leads need email search`);

        // Limit to first 100 to avoid long runtime
        const searchLimit = Math.min(leadsWithoutEmail.length, 100);

        for (let i = 0; i < searchLimit; i++) {
            const lead = leadsWithoutEmail[i];

            try {
                console.log(`Searching for email ${i + 1}/${searchLimit}: ${lead.name} at ${lead.company}`);

                const emailResult = await findPersonEmail({
                    name: lead.name,
                    firstName: lead.firstName,
                    lastName: lead.lastName,
                    company: lead.company,
                    companyWebsite: lead.companyWebsite,
                    jobTitle: lead.jobTitle,
                });

                if (emailResult.emails && emailResult.emails.length > 0) {
                    lead.email = emailResult.emails[0];
                    lead.emailConfidence = emailResult.confidence;
                    lead.possibleEmails = emailResult.emails;
                    console.log(`✅ Found email: ${lead.email}`);
                }

                await randomDelay(3000, 5000);
            } catch (error) {
                console.log(`Email search failed for ${lead.name}: ${error.message}`);
            }
        }
    }

    // ===== PHASE 5: Data Processing & Enrichment =====
    console.log('\n⚙️ Phase 5: Data Processing & Enrichment');

    const processedLeads = await processLeads(allLeads, {
        deduplicate: true,
        enrich: true,
        minQualityScore: 30,
        verifyEmail: emailVerification,
    });

    console.log(`\n✅ Final Results: ${processedLeads.length} qualified leads`);

    // ===== PHASE 6: Save Results =====
    console.log('\n💾 Phase 6: Saving Results');

    // Save to default dataset
    await Actor.pushData(processedLeads);

    // Generate statistics
    const stats = {
        totalLeadsCollected: allLeads.length,
        totalLeadsAfterProcessing: processedLeads.length,
        leadsWithEmail: processedLeads.filter(l => l.email).length,
        leadsWithPhone: processedLeads.filter(l => l.phone).length,
        leadsWithLinkedIn: processedLeads.filter(l => l.linkedInUrl).length,
        leadsWithXing: processedLeads.filter(l => l.xingUrl).length,
        averageQualityScore: processedLeads.reduce((sum, l) => sum + (l.qualityScore || 0), 0) / processedLeads.length,
        sourceBreakdown: {
            linkedin: processedLeads.filter(l => l.source?.includes('linkedin')).length,
            xing: processedLeads.filter(l => l.source?.includes('xing')).length,
            web: processedLeads.filter(l => l.source?.includes('web')).length,
        },
        emailConfidenceBreakdown: {
            verified: processedLeads.filter(l => l.emailConfidence === 'verified').length,
            high: processedLeads.filter(l => l.emailConfidence === 'high').length,
            medium: processedLeads.filter(l => l.emailConfidence === 'medium').length,
            low: processedLeads.filter(l => l.emailConfidence === 'low').length,
        },
    };

    console.log('\n📊 Statistics:');
    console.log(`  Total Leads: ${stats.totalLeadsAfterProcessing}`);
    console.log(`  Leads with Email: ${stats.leadsWithEmail} (${((stats.leadsWithEmail / stats.totalLeadsAfterProcessing) * 100).toFixed(1)}%)`);
    console.log(`  Leads with Phone: ${stats.leadsWithPhone}`);
    console.log(`  Average Quality Score: ${stats.averageQualityScore.toFixed(1)}`);
    console.log(`  Source Breakdown:`, stats.sourceBreakdown);
    console.log(`  Email Confidence:`, stats.emailConfidenceBreakdown);

    await Actor.setValue('OUTPUT_STATS', stats);

    // ===== GDPR Notice =====
    console.log('\n⚠️ GDPR NOTICE:');
    console.log('  This actor collects publicly available data only.');
    console.log('  Users are responsible for compliance with GDPR and local privacy laws.');
    console.log('  Ensure you have legal basis for processing this data.');
    console.log('  Implement opt-out mechanisms as required by law.');

    console.log('\n✨ Actor finished successfully!');
});
