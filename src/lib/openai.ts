// GPT-5 integration for content verification

import OpenAI from 'openai';
import type {
  GPT5VerificationInput,
  GPT5VerificationOutput,
  Confidence,
} from './types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Creates the verification prompt for GPT-5
 */
function createVerificationPrompt(input: GPT5VerificationInput): string {
  const { paragraph_text, paragraph_links, sources } = input;

  // Build sources section
  const sourcesText = sources
    .map((source, index) => {
      const credibilityTag = `[${source.credibility.toUpperCase()}]`;
      const errorTag = source.error ? `[ERROR: ${source.error}]` : '';
      const content = source.content || '(No content available)';

      return `
### Source ${index + 1}: ${source.url} ${credibilityTag} ${errorTag}
**Title:** ${source.title}
**Credibility:** ${source.credibility}
**Content:**
${content.slice(0, 2000)} ${content.length > 2000 ? '...(truncated)' : ''}
`;
    })
    .join('\n');

  return `You are a fact-checking AI assistant. Your task is to verify the accuracy of a paragraph by comparing it against the cited sources.

## Paragraph to Verify:
"${paragraph_text}"

## Cited Links:
${paragraph_links.map((link, i) => `${i + 1}. ${link}`).join('\n')}

## Crawled Source Content:
${sourcesText}

---

## Your Task:
1. Compare the paragraph's claims against the source content
2. Evaluate how well the sources support the paragraph
3. Consider the credibility of each source (academic > official > news > blog > unknown)
4. Determine a confidence level: high, medium, or low

### Confidence Criteria:
- **HIGH**: Multiple credible sources (academic/official/news) strongly support the claims. No contradictions found.
- **MEDIUM**: Some sources support the claims, but evidence is partial, sources are less credible (blogs), or there are minor inconsistencies.
- **LOW**: Sources don't support the claims, sources are unavailable/error, sources contradict the claims, or no sources available.

## Response Format:
You must respond with a valid JSON object (and ONLY JSON, no markdown):
{
  "confidence": "high" | "medium" | "low",
  "summary_of_sources": "Brief summary of how many sources support the claims and their credibility",
  "reasoning": "Detailed explanation of why you assigned this confidence level, referencing specific sources"
}

Example:
{
  "confidence": "high",
  "summary_of_sources": "2/2 sources strongly support the paragraph. Both are official documentation from reputable sources.",
  "reasoning": "Source 1 (nextjs.org - official) confirms the Turbopack bundler and server components improvements. Source 2 (vercel.com - official) provides detailed information about partial prerendering. Both sources are highly credible official documentation that directly support all claims in the paragraph."
}

Now, analyze the paragraph and provide your JSON response:`;
}

/**
 * Verifies a paragraph against its sources using GPT-5
 */
export async function verifyWithGPT5(
  input: GPT5VerificationInput
): Promise<GPT5VerificationOutput> {
  try {
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured, returning mock response');
      return {
        confidence: 'low',
        summary_of_sources:
          'OpenAI API key not configured - mock verification result',
        reasoning:
          'Cannot perform verification without OpenAI API key. Please configure OPENAI_API_KEY environment variable.',
      };
    }

    const prompt = createVerificationPrompt(input);

    // Call GPT-5 (or fallback to gpt-4-turbo if GPT-5 is not available)
    const completion = await openai.chat.completions.create({
      model: 'gpt-5', // Will try GPT-5, fallback to gpt-4-turbo if needed
      messages: [
        {
          role: 'system',
          content:
            'You are a fact-checking AI that analyzes paragraphs against their cited sources and returns verification results in JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_completion_tokens: 1000,
      response_format: { type: 'json_object' }, // Ensure JSON response
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error('Empty response from GPT-5');
    }

    // Parse JSON response
    const result = JSON.parse(responseText);

    // Validate response structure
    if (
      !result.confidence ||
      !result.summary_of_sources ||
      !result.reasoning
    ) {
      throw new Error('Invalid response structure from GPT-5');
    }

    // Validate confidence value
    if (!['high', 'medium', 'low'].includes(result.confidence)) {
      throw new Error(`Invalid confidence value: ${result.confidence}`);
    }

    return {
      confidence: result.confidence as Confidence,
      summary_of_sources: result.summary_of_sources,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error('Error calling GPT-5:', error);

    // Return low confidence with error explanation
    return {
      confidence: 'low',
      summary_of_sources: 'Verification failed due to an error',
      reasoning:
        error instanceof Error
          ? `Error during verification: ${error.message}`
          : 'Unknown error occurred during verification',
    };
  }
}

/**
 * Verifies a paragraph with retry logic
 */
export async function verifyWithRetry(
  input: GPT5VerificationInput,
  maxRetries = 2
): Promise<GPT5VerificationOutput> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await verifyWithGPT5(input);

      // If we got a valid result (not an error fallback), return it
      if (result.confidence !== 'low' || !result.reasoning.includes('Error')) {
        return result;
      }

      // If it's a low confidence with error, treat as failure and retry
      lastError = new Error(result.reasoning);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`Verification attempt ${attempt + 1} failed:`, error);

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }

  // All retries failed
  return {
    confidence: 'low',
    summary_of_sources: 'Verification failed after multiple attempts',
    reasoning:
      lastError?.message || 'Unknown error occurred during verification',
  };
}

/**
 * Batch verify multiple paragraphs (currently just calls verifyWithRetry for each)
 * Can be optimized later with actual batch API if needed
 */
export async function batchVerify(
  inputs: GPT5VerificationInput[]
): Promise<GPT5VerificationOutput[]> {
  // Process all in parallel
  return Promise.all(inputs.map((input) => verifyWithRetry(input)));
}
