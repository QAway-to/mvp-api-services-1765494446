/**
 * Bitrix24 Contact Management
 * Handles contact upsert logic
 */

import { callBitrixAPI } from './client.js';

/**
 * Find contact by email
 * @param {string} webhookUrl - Bitrix webhook URL
 * @param {string} email - Contact email
 * @returns {Promise<number|null>} Contact ID or null if not found
 */
export async function findContactByEmail(webhookUrl, email) {
  if (!email) {
    return null;
  }

  try {
    const result = await callBitrixAPI(webhookUrl, 'crm.contact.list', {
      filter: { EMAIL: email },
      select: ['ID', 'NAME', 'LAST_NAME', 'EMAIL']
    });

    if (result.result && result.result.length > 0) {
      return parseInt(result.result[0].ID);
    }

    return null;
  } catch (error) {
    console.error('[BITRIX CONTACT] Error finding contact by email:', error);
    return null;
  }
}

/**
 * Create contact in Bitrix24
 * @param {string} webhookUrl - Bitrix webhook URL
 * @param {Object} contactData - Contact data
 * @returns {Promise<number|null>} Created contact ID or null on error
 */
export async function createContact(webhookUrl, contactData) {
  try {
    // Match Python script structure
    const fields = {
      NAME: contactData.firstName || 'Shopify',
      LAST_NAME: contactData.lastName || 'Customer',
      OPENED: 'Y',
      TYPE_ID: 'CLIENT',
      SOURCE_ID: 'WEB', // Default source
      EMAIL: contactData.email ? [{ VALUE: contactData.email, VALUE_TYPE: 'WORK' }] : [],
    };

    // Add phone if available
    if (contactData.phone) {
      fields.PHONE = [{ VALUE: contactData.phone, VALUE_TYPE: 'WORK' }];
    }

    // Add address if available
    if (contactData.address) {
      const addr = contactData.address;
      fields.ADDRESS = {
        ADDRESS_1: addr.address1 || '',
        ADDRESS_2: addr.address2 || '',
        CITY: addr.city || '',
        POSTAL_CODE: addr.zip || '',
        COUNTRY: addr.country || '',
        PROVINCE: addr.province || ''
      };
    }

    const result = await callBitrixAPI(webhookUrl, 'crm.contact.add', { fields });

    if (result.result) {
      return parseInt(result.result);
    }

    return null;
  } catch (error) {
    console.error('[BITRIX CONTACT] Error creating contact:', error);
    return null;
  }
}

/**
 * Upsert contact - find by email or create new
 * @param {string} webhookUrl - Bitrix webhook URL
 * @param {Object} shopifyOrder - Shopify order object
 * @returns {Promise<number|null>} Contact ID or null
 */
export async function upsertBitrixContact(webhookUrl, shopifyOrder) {
  // Get email from order
  const email = shopifyOrder.customer?.email || 
                shopifyOrder.email || 
                shopifyOrder.billing_address?.email || 
                null;

  if (!email) {
    console.log('[BITRIX CONTACT] No email found in order, skipping contact creation');
    return null;
  }

  // Try to find existing contact
  let contactId = await findContactByEmail(webhookUrl, email);

  if (contactId) {
    console.log(`[BITRIX CONTACT] Found existing contact with ID: ${contactId}`);
    return contactId;
  }

  // Create new contact
  const customer = shopifyOrder.customer || {};
  const billingAddress = shopifyOrder.billing_address || {};
  const shippingAddress = shopifyOrder.shipping_address || {};
  const address = shippingAddress.address1 ? shippingAddress : billingAddress;

  const contactData = {
    firstName: customer.first_name || billingAddress.first_name || '',
    lastName: customer.last_name || billingAddress.last_name || '',
    email: email,
    phone: customer.phone || billingAddress.phone || null,
    address: address.address1 ? {
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      zip: address.zip,
      province: address.province,
      country: address.country
    } : null
  };

  contactId = await createContact(webhookUrl, contactData);

  if (contactId) {
    console.log(`[BITRIX CONTACT] Created new contact with ID: ${contactId}`);
  } else {
    console.error('[BITRIX CONTACT] Failed to create contact');
  }

  return contactId;
}

