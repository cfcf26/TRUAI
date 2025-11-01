// In-memory storage for verification jobs and results

import type {
  VerificationJob,
  VerificationResult,
  Paragraph,
} from './types';

// Event listener type for real-time updates
type VerificationUpdateListener = (result: VerificationResult) => void;
type VerificationCompleteListener = (docId: string) => void;
type VerificationErrorListener = (
  docId: string,
  paragraphId: number,
  error: string
) => void;

interface EventListeners {
  onUpdate: VerificationUpdateListener[];
  onComplete: VerificationCompleteListener[];
  onError: VerificationErrorListener[];
}

/**
 * In-memory storage for verification system
 * Note: Data will be lost on server restart
 */
class VerificationStorage {
  private jobs: Map<string, VerificationJob[]> = new Map();
  private results: Map<string, VerificationResult[]> = new Map();
  private listeners: EventListeners = {
    onUpdate: [],
    onComplete: [],
    onError: [],
  };

  /**
   * Creates verification jobs for a document's paragraphs
   */
  createJobs(docId: string, paragraphs: Paragraph[]): VerificationJob[] {
    const jobs: VerificationJob[] = paragraphs.map((paragraph) => ({
      doc_id: docId,
      paragraph,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
    }));

    this.jobs.set(docId, jobs);
    return jobs;
  }

  /**
   * Gets all jobs for a document
   */
  getJobs(docId: string): VerificationJob[] {
    return this.jobs.get(docId) || [];
  }

  /**
   * Gets a specific job
   */
  getJob(docId: string, paragraphId: number): VerificationJob | undefined {
    const jobs = this.jobs.get(docId) || [];
    return jobs.find((job) => job.paragraph.id === paragraphId);
  }

  /**
   * Updates job status
   */
  updateJobStatus(
    docId: string,
    paragraphId: number,
    status: VerificationJob['status']
  ): void {
    const jobs = this.jobs.get(docId);
    if (!jobs) return;

    const job = jobs.find((j) => j.paragraph.id === paragraphId);
    if (job) {
      job.status = status;
      job.updated_at = new Date();
    }
  }

  /**
   * Stores a verification result
   */
  storeResult(result: VerificationResult): void {
    const { doc_id } = result;

    // Get existing results or create new array
    const results = this.results.get(doc_id) || [];

    // Replace existing result for this paragraph or add new one
    const existingIndex = results.findIndex(
      (r) => r.paragraph_id === result.paragraph_id
    );

    if (existingIndex >= 0) {
      results[existingIndex] = result;
    } else {
      results.push(result);
    }

    this.results.set(doc_id, results);

    console.log(
      `[Storage] Stored result for paragraph ${result.paragraph_id} in doc ${doc_id}. Total results: ${results.length}, Listeners: ${this.listeners.onUpdate.length}`
    );

    // Update job status
    this.updateJobStatus(doc_id, result.paragraph_id, 'completed');

    // Notify listeners
    this.notifyUpdate(result);

    // Check if all jobs are complete
    const jobs = this.getJobs(doc_id);
    const allComplete = jobs.every((job) => job.status === 'completed' || job.status === 'failed');

    if (allComplete && jobs.length > 0) {
      this.notifyComplete(doc_id);
    }
  }

  /**
   * Gets all results for a document
   */
  getResults(docId: string): VerificationResult[] {
    return this.results.get(docId) || [];
  }

  /**
   * Gets a specific result
   */
  getResult(docId: string, paragraphId: number): VerificationResult | undefined {
    const results = this.results.get(docId) || [];
    return results.find((r) => r.paragraph_id === paragraphId);
  }

  /**
   * Stores an error for a job
   */
  storeError(docId: string, paragraphId: number, error: string): void {
    const job = this.getJob(docId, paragraphId);
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.updated_at = new Date();
    }

    // Notify error listeners
    this.notifyError(docId, paragraphId, error);

    // Check if all jobs are complete
    const jobs = this.getJobs(docId);
    const allComplete = jobs.every((job) => job.status === 'completed' || job.status === 'failed');

    if (allComplete && jobs.length > 0) {
      this.notifyComplete(docId);
    }
  }

  /**
   * Clears all data for a document
   */
  clearDocument(docId: string): void {
    this.jobs.delete(docId);
    this.results.delete(docId);
  }

  /**
   * Clears all data (useful for testing)
   */
  clearAll(): void {
    this.jobs.clear();
    this.results.clear();
  }

  /**
   * Gets statistics about stored data
   */
  getStats() {
    return {
      totalDocuments: this.jobs.size,
      totalJobs: Array.from(this.jobs.values()).reduce(
        (sum, jobs) => sum + jobs.length,
        0
      ),
      totalResults: Array.from(this.results.values()).reduce(
        (sum, results) => sum + results.length,
        0
      ),
    };
  }

  // ============================================================================
  // Event Listener Management (Pub/Sub Pattern)
  // ============================================================================

  /**
   * Registers a listener for verification updates
   */
  onUpdate(listener: VerificationUpdateListener): () => void {
    this.listeners.onUpdate.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.onUpdate.indexOf(listener);
      if (index >= 0) {
        this.listeners.onUpdate.splice(index, 1);
      }
    };
  }

  /**
   * Registers a listener for verification completion
   */
  onComplete(listener: VerificationCompleteListener): () => void {
    this.listeners.onComplete.push(listener);

    return () => {
      const index = this.listeners.onComplete.indexOf(listener);
      if (index >= 0) {
        this.listeners.onComplete.splice(index, 1);
      }
    };
  }

  /**
   * Registers a listener for verification errors
   */
  onError(listener: VerificationErrorListener): () => void {
    this.listeners.onError.push(listener);

    return () => {
      const index = this.listeners.onError.indexOf(listener);
      if (index >= 0) {
        this.listeners.onError.splice(index, 1);
      }
    };
  }

  /**
   * Notifies all update listeners
   */
  private notifyUpdate(result: VerificationResult): void {
    this.listeners.onUpdate.forEach((listener) => {
      try {
        listener(result);
      } catch (error) {
        console.error('Error in update listener:', error);
      }
    });
  }

  /**
   * Notifies all completion listeners
   */
  private notifyComplete(docId: string): void {
    this.listeners.onComplete.forEach((listener) => {
      try {
        listener(docId);
      } catch (error) {
        console.error('Error in complete listener:', error);
      }
    });
  }

  /**
   * Notifies all error listeners
   */
  private notifyError(docId: string, paragraphId: number, error: string): void {
    this.listeners.onError.forEach((listener) => {
      try {
        listener(docId, paragraphId, error);
      } catch (error) {
        console.error('Error in error listener:', error);
      }
    });
  }

  /**
   * Removes all listeners (useful for testing)
   */
  clearListeners(): void {
    this.listeners.onUpdate = [];
    this.listeners.onComplete = [];
    this.listeners.onError = [];
  }
}

// Export singleton instance
export const storage = new VerificationStorage();
