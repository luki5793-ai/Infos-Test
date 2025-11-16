/**
 * Email validation module
 */

import { validate as validateEmailFormat } from 'email-validator';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

/**
 * Validate email format using regex
 * @param {string} email - Email address to validate
 * @returns {boolean} - Whether email format is valid
 */
export function validateEmailSyntax(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }

    return validateEmailFormat(email);
}

/**
 * Check if domain has valid MX records (DNS verification)
 * @param {string} email - Email address
 * @returns {Promise<boolean>} - Whether domain has valid MX records
 */
export async function verifyDomainMX(email) {
    if (!validateEmailSyntax(email)) {
        return false;
    }

    const domain = email.split('@')[1];

    try {
        const addresses = await resolveMx(domain);
        return addresses && addresses.length > 0;
    } catch (error) {
        // DNS lookup failed - domain doesn't exist or has no MX records
        return false;
    }
}

/**
 * Check if email domain is a common disposable email provider
 * @param {string} email - Email address
 * @returns {boolean} - Whether it's a disposable email
 */
export function isDisposableEmail(email) {
    if (!email) return false;

    const domain = email.split('@')[1]?.toLowerCase();

    const disposableDomains = [
        'tempmail.com',
        'guerrillamail.com',
        'mailinator.com',
        '10minutemail.com',
        'throwaway.email',
        'temp-mail.org',
        'fake-mail.com',
    ];

    return disposableDomains.includes(domain);
}

/**
 * Check if email is from a free email provider (less professional)
 * @param {string} email - Email address
 * @returns {boolean} - Whether it's a free email provider
 */
export function isFreeEmailProvider(email) {
    if (!email) return false;

    const domain = email.split('@')[1]?.toLowerCase();

    const freeProviders = [
        'gmail.com',
        'yahoo.com',
        'outlook.com',
        'hotmail.com',
        'web.de',
        'gmx.de',
        'gmx.net',
        't-online.de',
        'freenet.de',
        'aol.com',
    ];

    return freeProviders.includes(domain);
}

/**
 * Comprehensive email validation
 * @param {string} email - Email address to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.checkMX - Whether to check MX records (slower)
 * @param {boolean} options.allowFreeProviders - Whether to allow free email providers
 * @param {boolean} options.allowDisposable - Whether to allow disposable emails
 * @returns {Promise<Object>} - Validation result
 */
export async function validateEmail(email, options = {}) {
    const {
        checkMX = false,
        allowFreeProviders = true,
        allowDisposable = false,
    } = options;

    const result = {
        email,
        isValid: false,
        validFormat: false,
        hasMX: null,
        isDisposable: false,
        isFreeProvider: false,
        errors: [],
    };

    // Check format
    result.validFormat = validateEmailSyntax(email);
    if (!result.validFormat) {
        result.errors.push('Invalid email format');
        return result;
    }

    // Check if disposable
    result.isDisposable = isDisposableEmail(email);
    if (result.isDisposable && !allowDisposable) {
        result.errors.push('Disposable email addresses not allowed');
        return result;
    }

    // Check if free provider
    result.isFreeProvider = isFreeEmailProvider(email);
    if (result.isFreeProvider && !allowFreeProviders) {
        result.errors.push('Free email providers not allowed');
        return result;
    }

    // Check MX records if requested
    if (checkMX) {
        try {
            result.hasMX = await verifyDomainMX(email);
            if (!result.hasMX) {
                result.errors.push('Domain has no valid MX records');
                return result;
            }
        } catch (error) {
            result.errors.push(`MX check failed: ${error.message}`);
            return result;
        }
    }

    // If all checks passed
    if (result.errors.length === 0) {
        result.isValid = true;
    }

    return result;
}

/**
 * Batch validate emails
 * @param {Array<string>} emails - Array of email addresses
 * @param {Object} options - Validation options
 * @returns {Promise<Array<Object>>} - Array of validation results
 */
export async function validateEmailBatch(emails, options = {}) {
    const results = [];

    for (const email of emails) {
        try {
            const result = await validateEmail(email, options);
            results.push(result);
        } catch (error) {
            results.push({
                email,
                isValid: false,
                error: error.message,
            });
        }
    }

    return results;
}

/**
 * Filter valid emails from a list
 * @param {Array<string>} emails - Array of email addresses
 * @param {Object} options - Validation options
 * @returns {Promise<Array<string>>} - Array of valid emails
 */
export async function filterValidEmails(emails, options = {}) {
    const results = await validateEmailBatch(emails, options);
    return results
        .filter(result => result.isValid)
        .map(result => result.email);
}
