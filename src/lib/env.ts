// Load environment variables as early as possible
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local file
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Export environment variables with defaults
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || '';

// Log configuration status (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log('[Env] OpenAI API Key configured:', !!OPENAI_API_KEY);
  console.log('[Env] ScrapingBee API Key configured:', !!SCRAPINGBEE_API_KEY);
}
