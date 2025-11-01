// Custom Next.js server with Socket.io for WebSocket support

// IMPORTANT: Import env first to load environment variables
import './src/lib/env';

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { storage } from './src/lib/storage';
import { startVerificationJob } from './src/lib/verification';
import type {
  WSClientMessage,
  WSVerificationRequest,
  WSServerMessage,
  VerificationResult,
} from './src/lib/types';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.io
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // In production, specify your domain
      methods: ['GET', 'POST'],
    },
    path: '/socket.io/',
  });

  console.log('[Server] Socket.io server initialized');

  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to TruAI Verification Server',
      socketId: socket.id,
    });

    // Handle verification requests
    socket.on('verify', (message: WSVerificationRequest) => {
      console.log(
        `[WebSocket] Received verification request for doc: ${message.doc_id} from ${socket.id}`
      );

      const { doc_id, paragraphs } = message;

      // Validate input
      if (!doc_id || !paragraphs || !Array.isArray(paragraphs)) {
        socket.emit('error', {
          type: 'verification_error',
          doc_id: doc_id || 'unknown',
          paragraph_id: 0,
          error: 'Invalid verification request',
        });
        return;
      }

      // Set up listeners for verification updates
      const unsubscribeUpdate = storage.onUpdate((result: VerificationResult) => {
        if (result.doc_id === doc_id) {
          const message: WSServerMessage = {
            type: 'verification_update',
            result,
          };
          socket.emit('verification_update', message);
          console.log(
            `[WebSocket] Sent update for paragraph ${result.paragraph_id} to ${socket.id}`
          );
        }
      });

      const unsubscribeComplete = storage.onComplete((completedDocId: string) => {
        if (completedDocId === doc_id) {
          const message: WSServerMessage = {
            type: 'verification_complete',
            doc_id: completedDocId,
          };
          socket.emit('verification_complete', message);
          console.log(
            `[WebSocket] Sent completion for ${completedDocId} to ${socket.id}`
          );

          // Clean up listeners after completion
          unsubscribeUpdate();
          unsubscribeComplete();
          unsubscribeError();
        }
      });

      const unsubscribeError = storage.onError(
        (errorDocId: string, paragraphId: number, error: string) => {
          if (errorDocId === doc_id) {
            const message: WSServerMessage = {
              type: 'verification_error',
              doc_id: errorDocId,
              paragraph_id: paragraphId,
              error,
            };
            socket.emit('verification_error', message);
            console.log(
              `[WebSocket] Sent error for paragraph ${paragraphId} to ${socket.id}`
            );
          }
        }
      );

      // Start verification job in background
      console.log(
        `[WebSocket] Starting verification job for ${doc_id} with ${paragraphs.length} paragraphs`
      );
      // Use sequential processing with 1s delay to avoid OpenAI rate limits
      startVerificationJob(doc_id, paragraphs, true, 1000);

      // Send acknowledgment
      socket.emit('verification_started', {
        doc_id,
        paragraph_count: paragraphs.length,
      });
    });

    // Handle get_results request
    socket.on('get_results', (data: { doc_id: string }) => {
      const { doc_id } = data;
      const results = storage.getResults(doc_id);

      socket.emit('results', {
        doc_id,
        results,
      });

      console.log(
        `[WebSocket] Sent ${results.length} results for ${doc_id} to ${socket.id}`
      );
    });

    // Handle get_progress request
    socket.on('get_progress', (data: { doc_id: string }) => {
      const { doc_id } = data;
      const jobs = storage.getJobs(doc_id);

      const progress = {
        total: jobs.length,
        completed: jobs.filter((j) => j.status === 'completed').length,
        failed: jobs.filter((j) => j.status === 'failed').length,
        pending: jobs.filter((j) => j.status === 'pending').length,
        in_progress: jobs.filter((j) => j.status === 'in_progress').length,
      };

      socket.emit('progress', {
        doc_id,
        ...progress,
      });

      console.log(`[WebSocket] Sent progress for ${doc_id} to ${socket.id}`);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] Client disconnected: ${socket.id} (${reason})`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[WebSocket] Socket error for ${socket.id}:`, error);
    });
  });

  // Start server
  httpServer.listen(port, () => {
    console.log(`[Server] Ready on http://${hostname}:${port}`);
    console.log(`[Server] WebSocket endpoint: ws://${hostname}:${port}/socket.io/`);
  });
});
