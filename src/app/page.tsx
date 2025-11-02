"use client";

import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { GooeyText } from "@/components/ui/gooey-text-morphing";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { ContentAnalyzer } from "@/components/ContentAnalyzer";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnalyzedContent } from "@/types/content";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [analyzedContent, setAnalyzedContent] = useState<AnalyzedContent | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [docId, setDocId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Polling effect for verification updates
  useEffect(() => {
    if (!docId || !analyzedContent) {
      return;
    }

    console.log(`[Polling] Starting verification polling for doc ${docId}`);

    // Function to fetch verification results
    const fetchVerificationResults = async () => {
      try {
        const response = await fetch(`/api/verification/${docId}`);
        if (!response.ok) {
          console.error('[Polling] Failed to fetch verification results');
          return;
        }

        const data = await response.json();

        if (!data.success) {
          console.error('[Polling] Verification API returned error:', data.error);
          return;
        }

        // If no jobs exist, the doc_id might be invalid or server restarted
        // Stop polling and show error
        if (data.jobs.length === 0 && data.results.length === 0) {
          console.warn('[Polling] No jobs found for doc_id. Server may have restarted.');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        // Update paragraphs with verification results
        setAnalyzedContent((prev) => {
          if (!prev) return prev;

          const updatedParagraphs = prev.paragraphs.map((paragraph) => {
            // Find matching result
            const result = data.results.find(
              (r: { paragraph_id: number; confidence: string; reasoning: string }) => r.paragraph_id === paragraph.id
            );

            if (result) {
              // Convert confidence to percentage
              const confidenceMap = { high: 85, medium: 50, low: 15 };

              return {
                ...paragraph,
                confidenceLevel: result.confidence,
                confidence: confidenceMap[result.confidence as keyof typeof confidenceMap],
                reasoning: result.reasoning,
                // Keep existing sources from initial parse
              };
            }

            // Check if job failed
            const job = data.jobs.find((j: { paragraph_id: number; status: string; error?: string }) => j.paragraph_id === paragraph.id);
            if (job?.status === 'failed') {
              return {
                ...paragraph,
                confidenceLevel: 'low' as const,
                confidence: 0,
                reasoning: `검증 실패: ${job.error || '알 수 없는 오류'}`,
              };
            }

            return paragraph;
          });

          return {
            ...prev,
            paragraphs: updatedParagraphs,
          };
        });

        // Stop polling if all verification is complete
        if (data.progress.percentComplete === 100) {
          console.log('[Polling] Verification complete, stopping polling');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('[Polling] Error fetching verification results:', error);
      }
    };

    // Initial fetch
    fetchVerificationResults();

    // Set up polling interval (every 3 seconds)
    pollingIntervalRef.current = setInterval(fetchVerificationResults, 3000);

    // Cleanup on unmount or when docId/analyzedContent changes
    return () => {
      if (pollingIntervalRef.current) {
        console.log('[Polling] Cleaning up polling interval');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, analyzedContent?.title]); // Use title as dependency to avoid infinite loop

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

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setIsLoading(true);
      setAnalyzedContent(null);

      fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: inputValue }),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error("Network response was not ok");
          }
          return res.json();
        })
        .then((data) => {
          // Save doc_id for polling
          setDocId(data.doc_id);

          // 데이터 구조 변환 (백엔드 -> 프론트엔드)
          const transformedContent: AnalyzedContent = {
            title: `분석 결과: ${data.source_url}`,
            sourceUrl: data.source_url,
            paragraphs: data.paragraphs.map((p: { id: number; text: string; links: string[]; isHeading?: boolean; headingLevel?: number }) => ({
              id: p.id,
              content: p.text,
              confidenceLevel: "medium", // 초기 상태는 '분석중'
              confidence: 50, // 초기 값
              sources: p.links,
              reasoning: "현재 문단에 대한 신뢰도를 분석하고 있습니다...",
              isHeading: p.isHeading,
              headingLevel: p.headingLevel,
            })),
          };
          setAnalyzedContent(transformedContent);
        })
        .catch((error) => {
          console.error("Error fetching analysis:", error);
          // TODO: 사용자에게 에러 메시지 표시
        })
        .finally(() => {
          setIsLoading(false);
        });

      console.log("Submitted URL:", inputValue);
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
