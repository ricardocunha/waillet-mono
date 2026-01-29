import { StorageKey } from '../constants';
import type { IntentResponse } from '../types/api';
import { MessageType } from '../constants/enums';
import { browserAPI } from './browser-api';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface StoredMessage {
  id: string;
  type: MessageType;
  content: string;
  intent?: IntentResponse;
  timestamp: string; // ISO string for serialization
}

export interface ChatHistoryData {
  walletAddress: string;
  messages: StoredMessage[];
  lastUpdated: string;
}

/**
 * Filter messages to keep only those from the last 24 hours
 */
function filterRecentMessages(messages: StoredMessage[]): StoredMessage[] {
  const cutoffTime = Date.now() - TWENTY_FOUR_HOURS_MS;
  return messages.filter(msg => new Date(msg.timestamp).getTime() > cutoffTime);
}

/**
 * Load chat history from Chrome storage for a specific wallet
 */
export async function loadChatHistory(walletAddress: string): Promise<StoredMessage[]> {
  try {
    const result = await browserAPI.storage.local.get(StorageKey.CHAT_HISTORY);
    const data = result[StorageKey.CHAT_HISTORY] as ChatHistoryData | undefined;

    if (!data || data.walletAddress !== walletAddress) {
      return [];
    }

    // Filter to keep only last 24 hours
    return filterRecentMessages(data.messages);
  } catch (error) {
    console.error('Failed to load chat history:', error);
    return [];
  }
}

/**
 * Save chat history to Chrome storage
 */
export async function saveChatHistory(walletAddress: string, messages: StoredMessage[]): Promise<void> {
  try {
    // Only keep messages from the last 24 hours before saving
    const recentMessages = filterRecentMessages(messages);

    const data: ChatHistoryData = {
      walletAddress,
      messages: recentMessages,
      lastUpdated: new Date().toISOString()
    };

    await browserAPI.storage.local.set({ [StorageKey.CHAT_HISTORY]: data });
  } catch (error) {
    console.error('Failed to save chat history:', error);
  }
}

/**
 * Clear chat history from storage
 */
export async function clearChatHistory(): Promise<void> {
  try {
    await browserAPI.storage.local.remove(StorageKey.CHAT_HISTORY);
  } catch (error) {
    console.error('Failed to clear chat history:', error);
  }
}

/**
 * Convert Message (with Date) to StoredMessage (with string timestamp)
 */
export function toStoredMessage(message: {
  id: string;
  type: MessageType;
  content: string;
  intent?: IntentResponse;
  timestamp: Date;
}): StoredMessage {
  return {
    id: message.id,
    type: message.type,
    content: message.content,
    intent: message.intent,
    timestamp: message.timestamp.toISOString()
  };
}

/**
 * Convert StoredMessage (with string timestamp) to Message (with Date)
 */
export function fromStoredMessage(stored: StoredMessage): {
  id: string;
  type: MessageType;
  content: string;
  intent?: IntentResponse;
  timestamp: Date;
} {
  return {
    id: stored.id,
    type: stored.type,
    content: stored.content,
    intent: stored.intent,
    timestamp: new Date(stored.timestamp)
  };
}
