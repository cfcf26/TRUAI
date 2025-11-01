'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { VerificationResult, Paragraph } from '@/lib/types';

interface UseVerificationOptions {
  onUpdate?: (result: VerificationResult) => void;
  onComplete?: (docId: string) => void;
  onError?: (error: { docId: string; paragraphId: number; error: string }) => void;
}

interface VerificationState {
  isConnected: boolean;
  isVerifying: boolean;
  results: Map<number, VerificationResult>;
  errors: Map<number, string>;
}

export function useVerification(options: UseVerificationOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<VerificationState>({
    isConnected: false,
    isVerifying: false,
    results: new Map(),
    errors: new Map(),
  });

  // Initialize Socket.io connection
  useEffect(() => {
    const socket = io({
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WebSocket] Connected with ID:', socket.id);
      setState((prev) => ({ ...prev, isConnected: true }));
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setState((prev) => ({ ...prev, isConnected: false }));
    });

    socket.on('connected', (data) => {
      console.log('[WebSocket] Server welcome:', data);
    });

    socket.on('verification_started', (data: { doc_id: string; paragraph_count: number }) => {
      console.log('[WebSocket] Verification started:', data);
      setState((prev) => ({ ...prev, isVerifying: true }));
    });

    socket.on('verification_update', (data: { result: VerificationResult }) => {
      console.log('[WebSocket] Verification update:', data.result);
      const { result } = data;

      setState((prev) => {
        const newResults = new Map(prev.results);
        newResults.set(result.paragraph_id, result);
        return { ...prev, results: newResults };
      });

      options.onUpdate?.(result);
    });

    socket.on('verification_complete', (data: { doc_id: string }) => {
      console.log('[WebSocket] Verification complete:', data);
      setState((prev) => ({ ...prev, isVerifying: false }));
      options.onComplete?.(data.doc_id);
    });

    socket.on('verification_error', (data: { doc_id: string; paragraph_id: number; error: string }) => {
      console.error('[WebSocket] Verification error:', data);

      setState((prev) => {
        const newErrors = new Map(prev.errors);
        newErrors.set(data.paragraph_id, data.error);
        return { ...prev, errors: newErrors };
      });

      options.onError?.(data);
    });

    return () => {
      console.log('[WebSocket] Cleaning up connection');
      socket.disconnect();
    };
  }, []);

  // Start verification for a document
  const startVerification = useCallback((docId: string, paragraphs: Paragraph[]) => {
    if (!socketRef.current?.connected) {
      console.error('[WebSocket] Cannot start verification - not connected');
      return;
    }

    console.log('[WebSocket] Starting verification for doc:', docId);

    // Reset state
    setState((prev) => ({
      ...prev,
      isVerifying: true,
      results: new Map(),
      errors: new Map(),
    }));

    socketRef.current.emit('verify', { doc_id: docId, paragraphs });
  }, []);

  // Get results for a specific document
  const getResults = useCallback((docId: string) => {
    if (!socketRef.current?.connected) {
      console.error('[WebSocket] Cannot get results - not connected');
      return;
    }

    socketRef.current.emit('get_results', { doc_id: docId });
  }, []);

  // Get progress for a specific document
  const getProgress = useCallback((docId: string) => {
    if (!socketRef.current?.connected) {
      console.error('[WebSocket] Cannot get progress - not connected');
      return;
    }

    socketRef.current.emit('get_progress', { doc_id: docId });
  }, []);

  return {
    ...state,
    startVerification,
    getResults,
    getProgress,
  };
}
