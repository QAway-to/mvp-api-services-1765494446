/**
 * Bitrix24 Integration Module
 * Main entry point for all Bitrix24 related functions
 */

export { callBitrixAPI, callBitrix, getBitrixWebhookUrl, getBitrixWebhookBase } from './client.js';
export { BITRIX_CONFIG, financialStatusToStageId, sourceNameToSourceId } from './config.js';
export { upsertBitrixContact, findContactByEmail, createContact } from './contact.js';
export { mapShopifyOrderToBitrixDealFields } from './dealMapper.js';
export { mapShopifyOrderToBitrixDeal } from './orderMapper.js';
export { createProductRowsFromOrder, setBitrixDealProductRows } from './productRows.js';

