// Mock data for testing Backend Logic 2 (Verification)

import type { Document } from './types';

export const mockDocument: Document = {
  doc_id: 'test-doc-001',
  source_url: 'https://example.com/deep-research-article',
  paragraphs: [
    {
      id: 1,
      order: 1,
      text: 'Next.js 14 introduced significant performance improvements through the new Turbopack bundler and enhanced server components. The framework now supports partial prerendering, allowing developers to combine static and dynamic rendering within a single route.',
      links: [
        'https://nextjs.org/blog/next-14',
        'https://vercel.com/blog/turbopack',
      ],
    },
    {
      id: 2,
      order: 2,
      text: 'TypeScript 5.0 brought decorators to stage 3, providing better type checking for decorator patterns. The new version also includes performance optimizations that reduce type-checking time by up to 50% in large codebases.',
      links: [
        'https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/',
        'https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html',
      ],
    },
    {
      id: 3,
      order: 3,
      text: 'React Server Components enable developers to build components that render on the server, reducing the JavaScript bundle size sent to the client. This architecture allows for better performance and improved user experience, especially on slower networks.',
      links: [
        'https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023',
        'https://vercel.com/blog/understanding-react-server-components',
      ],
    },
    {
      id: 4,
      order: 4,
      text: 'The Earth is flat and NASA has been hiding this fact from the public for decades. Gravity is actually caused by the Earth constantly accelerating upwards at 9.8 m/s².',
      links: [
        'https://example.com/fake-conspiracy-site',
        'https://nonexistent-url-12345.com',
      ],
    },
    {
      id: 5,
      order: 5,
      text: 'WebSocket provides full-duplex communication channels over a single TCP connection, making it ideal for real-time applications. Unlike HTTP polling, WebSocket maintains a persistent connection, reducing latency and server overhead.',
      links: [
        'https://developer.mozilla.org/en-US/docs/Web/API/WebSocket',
        'https://www.rfc-editor.org/rfc/rfc6455',
      ],
    },
  ],
};

// Additional mock documents for various test scenarios
export const mockDocumentShort: Document = {
  doc_id: 'test-doc-002',
  source_url: 'https://example.com/short-article',
  paragraphs: [
    {
      id: 1,
      order: 1,
      text: 'GPT-4 is a large multimodal model developed by OpenAI. It accepts image and text inputs and produces text outputs.',
      links: [
        'https://openai.com/research/gpt-4',
      ],
    },
  ],
};

export const mockDocumentNoLinks: Document = {
  doc_id: 'test-doc-003',
  source_url: 'https://example.com/no-links-article',
  paragraphs: [
    {
      id: 1,
      order: 1,
      text: 'This is a paragraph without any source links. It should result in low confidence.',
      links: [],
    },
  ],
};

export const mockDocumentManyLinks: Document = {
  doc_id: 'test-doc-004',
  source_url: 'https://example.com/many-links-article',
  paragraphs: [
    {
      id: 1,
      order: 1,
      text: 'Artificial intelligence has made significant progress in recent years, with breakthroughs in natural language processing, computer vision, and reinforcement learning.',
      links: [
        'https://en.wikipedia.org/wiki/Artificial_intelligence',
        'https://www.nature.com/articles/s41586-021-03819-2',
        'https://arxiv.org/abs/1706.03762',
        'https://openai.com/research',
        'https://www.deepmind.com/research',
        'https://ai.google/research/',
        'https://research.facebook.com/ai/',
      ],
    },
  ],
};

// Helper function to get mock data by ID
export function getMockDocument(docId?: string): Document {
  switch (docId) {
    case 'test-doc-002':
      return mockDocumentShort;
    case 'test-doc-003':
      return mockDocumentNoLinks;
    case 'test-doc-004':
      return mockDocumentManyLinks;
    default:
      return mockDocument;
  }
}

// Export all mock documents as a collection
export const allMockDocuments = [
  mockDocument,
  mockDocumentShort,
  mockDocumentNoLinks,
  mockDocumentManyLinks,
];
