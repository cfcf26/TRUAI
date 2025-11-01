"use client";

import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { GooeyText } from "@/components/ui/gooey-text-morphing";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { ContentAnalyzer } from "@/components/ContentAnalyzer";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnalyzedContent } from "@/types/content";
import { useVerification } from "@/hooks/useVerification";
import { documentToAnalyzedContent, confidenceToNumber, confidenceToLevel } from "@/utils/typeAdapter";
import { Paragraph } from "@/lib/types";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [analyzedContent, setAnalyzedContent] = useState<AnalyzedContent | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);

  // WebSocket connection for real-time verification updates
  const verification = useVerification({
    onUpdate: useCallback((result) => {
      console.log('[UI] Received verification update:', result);

      setAnalyzedContent((prev) => {
        if (!prev) return prev;

        // Update the paragraph directly without needing the paragraphs state
        return {
          ...prev,
          paragraphs: prev.paragraphs.map((p) =>
            p.id === result.paragraph_id
              ? {
                  id: p.id,
                  content: p.content,
                  confidence: confidenceToNumber(result.confidence),
                  confidenceLevel: confidenceToLevel(result.confidence),
                  sources: result.link_digests.map((digest) => digest.url),
                  reasoning: result.reasoning,
                }
              : p
          ),
        };
      });
    }, []),

    onComplete: useCallback((docId) => {
      console.log('[UI] Verification complete for:', docId);
    }, []),

    onError: useCallback((error) => {
      console.error('[UI] Verification error:', error);
    }, []),
  });

  const placeholders = [
    "논문 URL을 입력하세요...",
    "연구 자료의 출처를 확인하세요...",
    "팩트체크가 필요한 기사 링크를 붙여넣으세요...",
    "검증하고 싶은 학술 자료 URL을 입력하세요...",
    "믿을 수 있는 연구인지 확인해보세요...",
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setIsLoading(true);
    setAnalyzedContent(null);

    try {
      console.log('[UI] Submitting URL to /api/ingest:', inputValue);

      // Call Backend Logic 1 (Ingest/Parse)
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputValue }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to ingest URL');
      }

      const data = await response.json();
      console.log('[UI] Received parsed document:', data);

      const { doc_id, source_url, paragraphs: parsedParagraphs } = data;

      // Store doc_id and paragraphs for later reference
      setCurrentDocId(doc_id);
      setParagraphs(parsedParagraphs);

      // Convert to UI format and display immediately
      const initialContent = documentToAnalyzedContent(source_url, parsedParagraphs);
      setAnalyzedContent(initialContent);
      setIsLoading(false);

      // Start real-time verification via WebSocket
      // (Backend Logic 2 is already running in background,
      // but we connect to receive updates)
      verification.startVerification(doc_id, parsedParagraphs);

    } catch (error) {
      console.error('[UI] Error ingesting URL:', error);
      setIsLoading(false);
      alert(error instanceof Error ? error.message : 'Failed to process URL');
    }
  };

  const loadingMessages = [
    "주소를 확인중이에요",
    "GPT(또는 Gemini) 주소에서 딥리서치 결과를 가져오고 있어요",
    "거의 다 왔어요 잠시만요!"
  ];

  return (
    <>
      {/* Loading Screen */}
      {isLoading && (
        <AuroraBackground>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="relative z-10 flex flex-col items-center w-full h-full"
          >
            {/* Top Spacer - 2/5 */}
            <div className="flex-[2] flex items-end justify-center pb-4">
              {/* TruAI Title - At 2/5 point */}
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="text-5xl sm:text-7xl font-bold tracking-tight text-foreground dark:text-white"
              >
                TruAI
              </motion.h1>
            </div>

            {/* Middle Spacer - 1/5 */}
            <div className="flex-[1] flex items-end justify-center">
              {/* GooeyText Loading Messages - At 3/5 point */}
              <div className="h-[80px] flex items-center justify-center w-full">
                <GooeyText
                  texts={loadingMessages}
                  morphTime={2.5}
                  cooldownTime={4}
                  className="font-bold"
                  textClassName="text-xl sm:text-2xl md:text-3xl"
                />
              </div>
            </div>

            {/* Bottom Spacer - 2/5 */}
            <div className="flex-[2]"></div>
          </motion.div>
        </AuroraBackground>
      )}

      {/* Analysis Result Screen */}
      {analyzedContent && !isLoading && (
        <div className="min-h-screen bg-white">
          {/* Header */}
          <header className="border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-6 py-6">
              <h1 className="text-[24px] font-medium leading-9 tracking-[0.0703125px] text-[#101828]">
                AI 할루시네이션 검증
              </h1>
            </div>
          </header>

          {/* Main Content */}
          <main className="py-12">
            <ContentAnalyzer content={analyzedContent} />
          </main>
        </div>
      )}

      {/* Input Screen */}
      {!isLoading && !analyzedContent && (
        <AuroraBackground>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="relative z-10 flex flex-col items-center justify-center w-full h-full p-4 sm:p-8"
          >
            {/* TruAI Title */}
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="text-5xl sm:text-7xl font-bold tracking-tight text-foreground dark:text-white"
            >
              TruAI
            </motion.h1>

            <main className="w-full max-w-4xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key="input-view"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center gap-8 text-center mt-8"
                >
                  {/* Subtitle */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="text-base sm:text-lg text-muted-foreground dark:text-gray-300 max-w-2xl mx-auto px-4"
                  >
                    AI 기반 팩트체크로 연구 자료의 신뢰성을 검증하세요
                  </motion.p>

                  {/* Input Field */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="w-full max-w-2xl px-4"
                  >
                    <PlaceholdersAndVanishInput
                      placeholders={placeholders}
                      onChange={handleChange}
                      onSubmit={onSubmit}
                    />
                  </motion.div>

                  {/* Subtle hint text */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="text-xs sm:text-sm text-muted-foreground/60 dark:text-gray-400"
                  >
                    연구 논문, 기사, 학술 자료의 URL을 입력하고 Enter를 누르세요
                  </motion.p>
                </motion.div>
              </AnimatePresence>
            </main>
          </motion.div>
        </AuroraBackground>
      )}
    </>
  );
}
