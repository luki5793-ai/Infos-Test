/**
 * Utility functions for the IT Decision Maker Lead Finder Actor
 */

/**
 * Generate email patterns based on name and company domain
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {string} domain - Company domain (e.g., "techfirma.de")
 * @returns {Array<string>} - Array of possible email patterns
 */
export function generateEmailPatterns(firstName, lastName, domain) {
    if (!firstName || !lastName || !domain) {
        return [];
    }

    const first = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const last = lastName.toLowerCase().replace(/[^a-z]/g, '');
    const firstInitial = first.charAt(0);

    const patterns = [
        `${first}.${last}@${domain}`,
        `${firstInitial}.${last}@${domain}`,
        `${first}_${last}@${domain}`,
        `${first}${last}@${domain}`,
        `${first}@${domain}`,
        `${last}@${domain}`,
        `${firstInitial}${last}@${domain}`,
    ];

    return [...new Set(patterns)]; // Remove duplicates
}

/**
 * Extract email addresses from text using regex
 * @param {string} text - Text to search
 * @returns {Array<string>} - Array of found email addresses
 */
export function extractEmailsFromText(text) {
    if (!text) return [];

    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex) || [];

    // Filter out common false positives
    return emails.filter(email => {
        const lowerEmail = email.toLowerCase();
        return !lowerEmail.includes('example.com') &&
               !lowerEmail.includes('test.com') &&
               !lowerEmail.includes('placeholder');
    });
}

/**
 * Extract company domain from URL or company name
 * @param {string} companyWebsite - Company website URL
 * @param {string} companyName - Company name as fallback
 * @returns {string|null} - Extracted domain
 */
export function extractDomain(companyWebsite, companyName) {
    if (companyWebsite) {
        try {
            const url = new URL(companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`);
            return url.hostname.replace('www.', '');
        } catch (e) {
            // Invalid URL, continue to fallback
        }
    }

    if (companyName) {
        // Try to generate domain from company name
        const cleaned = companyName
            .toLowerCase()
            .replace(/gmbh|ag|se|kg|ohg|gbr|ug/gi, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
        return `${cleaned}.de`;
    }

    return null;
}

/**
 * Normalize German special characters
 * @param {string} text - Text with German characters
 * @returns {string} - Normalized text
 */
export function normalizeGermanChars(text) {
    if (!text) return '';

    return text
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/Ä/g, 'Ae')
        .replace(/Ö/g, 'Oe')
        .replace(/Ü/g, 'Ue')
        .replace(/ß/g, 'ss');
}

/**
 * Sleep for a random duration to mimic human behavior
 * @param {number} minMs - Minimum milliseconds
 * @param {number} maxMs - Maximum milliseconds
 * @returns {Promise<void>}
 */
export async function randomDelay(minMs = 2000, maxMs = 5000) {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Get random user agent
 * @returns {string} - User agent string
 */
export function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Clean and normalize company name
 * @param {string} companyName - Raw company name
 * @returns {string} - Cleaned company name
 */
export function cleanCompanyName(companyName) {
    if (!companyName) return '';

    return companyName
        .replace(/\s+(GmbH|AG|SE|KG|OHG|GbR|UG|e\.K\.|e\.V\.)(\s|$)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Parse full name into first and last name
 * @param {string} fullName - Full name
 * @returns {{firstName: string, lastName: string}} - Parsed names
 */
export function parseFullName(fullName) {
    if (!fullName) return { firstName: '', lastName: '' };

    const parts = fullName.trim().split(/\s+/);

    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }

    // Assume first part is first name, rest is last name
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    return { firstName, lastName };
}

/**
 * Validate German phone number format
 * @param {string} phone - Phone number
 * @returns {boolean} - Whether it's a valid German phone number
 */
export function isValidGermanPhone(phone) {
    if (!phone) return false;

    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');

    // Check for German country code patterns
    return /^(\+49|0049|0)[1-9]\d{1,14}$/.test(cleaned);
}

/**
 * Format phone number to international format
 * @param {string} phone - Raw phone number
 * @returns {string|null} - Formatted phone number or null
 */
export function formatGermanPhone(phone) {
    if (!phone) return null;

    const cleaned = phone.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('+49')) {
        return cleaned;
    } else if (cleaned.startsWith('0049')) {
        return '+' + cleaned.substring(2);
    } else if (cleaned.startsWith('0')) {
        return '+49' + cleaned.substring(1);
    }

    return null;
}

/**
 * Calculate confidence score for email address
 * @param {string} email - Email address
 * @param {string} source - Source of email (verified, found, generated)
 * @returns {string} - Confidence level (verified, high, medium, low)
 */
export function calculateEmailConfidence(email, source) {
    if (!email) return 'low';

    if (source === 'verified') return 'verified';

    if (source === 'found') {
        // Found on website or profile
        return 'high';
    }

    if (source === 'generated') {
        // Pattern-based generation
        // Check if domain is common German business domain
        const commonDomains = ['.de', '.com', '.eu', '.org'];
        const hasCommonDomain = commonDomains.some(domain => email.endsWith(domain));

        return hasCommonDomain ? 'medium' : 'low';
    }

    return 'low';
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms
 * @returns {Promise<any>} - Result of function
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;

            const delay = baseDelay * Math.pow(2, i);
            console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Check if URL is valid
 * @param {string} url - URL to check
 * @returns {boolean} - Whether URL is valid
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Sanitize search query
 * @param {string} query - Search query
 * @returns {string} - Sanitized query
 */
export function sanitizeSearchQuery(query) {
    return query
        .replace(/[^\w\säöüÄÖÜß-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
