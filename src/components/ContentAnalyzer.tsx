"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnalyzedContent, ParagraphAnalysis } from "@/types/content";
import { Spinner } from "@/components/ui/Spinner";

interface ContentAnalyzerProps {
  content: AnalyzedContent;
}

export function ContentAnalyzer({ content }: ContentAnalyzerProps) {
  const [selectedParagraph, setSelectedParagraph] = useState<ParagraphAnalysis | null>(null);

  const getBackgroundColor = (paragraph: ParagraphAnalysis) => {
    // Headings don't need background colors (no verification)
    if (paragraph.isHeading) {
      return "";
    }

    // Don't show colors for unverified paragraphs (initial state)
    if (paragraph.confidence === 50 && paragraph.reasoning.includes("분석하고 있습니다")) {
      return "hover:bg-gray-50/50 cursor-pointer transition-colors";
    }

    switch (paragraph.confidenceLevel) {
      case "high":
        return "bg-[rgba(185,248,207,0.5)] hover:bg-[rgba(185,248,207,0.7)] cursor-pointer transition-colors"; // 초록색
      case "medium":
        return "bg-[rgba(255,240,133,0.5)] hover:bg-[rgba(255,240,133,0.7)] cursor-pointer transition-colors"; // 노란색
      case "low":
        return "bg-[rgba(255,201,201,0.5)] hover:bg-[rgba(255,201,201,0.7)] cursor-pointer transition-colors"; // 빨간색
      default:
        return "hover:bg-gray-50/50 cursor-pointer transition-colors";
    }
  };

  const getHeadingStyle = (headingLevel?: number) => {
    switch (headingLevel) {
      case 1:
        return "text-[36px] font-bold leading-[44px] -tracking-[0.7px] text-[#0A0E14] mt-10 mb-5 pb-4 border-b-2 border-gray-300";
      case 2:
        return "text-[30px] font-bold leading-[38px] -tracking-[0.6px] text-[#0A0E14] mt-8 mb-4 pb-3 border-b border-gray-300";
      case 3:
        return "text-[24px] font-bold leading-[32px] -tracking-[0.5px] text-[#1A1F29] mt-7 mb-3";
      case 4:
        return "text-[20px] font-semibold leading-[28px] -tracking-[0.4px] text-[#1A1F29] mt-6 mb-3";
      case 5:
        return "text-[18px] font-semibold leading-[26px] -tracking-[0.35px] text-[#2A3039] mt-5 mb-2";
      case 6:
        return "text-[17px] font-semibold leading-[25px] -tracking-[0.3px] text-[#2A3039] mt-4 mb-2";
      default:
        return "text-[16px] leading-[26px] -tracking-[0.3125px]";
    }
  };

  return (
    <div className="flex gap-6 max-w-7xl mx-auto px-6">
      {/* Main Document Card */}
      <div className="flex-1 max-w-[816px]">
        <div className="bg-white border border-gray-200 shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] rounded-[10px] px-12 py-6">
          {/* Paragraphs */}
          <div className="space-y-0">
            {(() => {
              const activeProcessingParagraph = content.paragraphs.find(
                (paragraph) =>
                  !paragraph.isHeading &&
                  paragraph.confidence === 50 &&
                  paragraph.reasoning.includes("분석하고 있습니다")
              );

              const activeProcessingId = activeProcessingParagraph?.id;

              return content.paragraphs.map((paragraph) => {
                const isProcessing =
                  !paragraph.isHeading &&
                  paragraph.confidence === 50 &&
                  paragraph.reasoning.includes("분석하고 있습니다");
                const isActiveProcessing = paragraph.id === activeProcessingId;

                return (
                  <div
                    key={paragraph.id}
                    className={`${paragraph.isHeading ? "" : "p-3 rounded my-2"} ${getBackgroundColor(paragraph)}`}
                    onClick={() => !paragraph.isHeading && setSelectedParagraph(paragraph)}
                    onMouseEnter={() => !paragraph.isHeading && setSelectedParagraph(paragraph)}
                  >
                    <div className="prose prose-sm max-w-none">
                      {paragraph.isHeading ? (
                        // Render heading with appropriate HTML tag (h1, h2, h3, etc.)
                        (() => {
                          const HeadingTag = `h${paragraph.headingLevel || 1}` as keyof JSX.IntrinsicElements;
                          return (
                            <HeadingTag className={getHeadingStyle(paragraph.headingLevel)}>
                              {paragraph.content}
                            </HeadingTag>
                          );
                        })()
                      ) : (
                        // Render regular paragraph
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => (
                              <p className="text-[16px] leading-[26px] -tracking-[0.3125px] text-[#101828] mb-0">
                                {children}
                              </p>
                            ),
                            a: ({ children, href }) => (
                              <a
                                href={href}
                                className="text-[#155DFC] hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {paragraph.content}
                        </ReactMarkdown>
                      )}
                    </div>

                    {/* Processing indicator remains visible even without hover */}
                    {isProcessing && isActiveProcessing && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-[#155DFC]">
                        <Spinner size="sm" />
                        <span className="text-[14px] leading-5 -tracking-[0.150391px]">
                          분석 중...
                        </span>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          {/* Source URL */}
          <div className="mt-10 pt-6 border-t border-gray-200">
            <p className="text-[14px] leading-5 text-gray-600 mb-2">원본 출처</p>
            <a
              href={content.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[16px] leading-6 text-[#155DFC] hover:underline break-all"
            >
              {content.sourceUrl}
            </a>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-[384px] flex-shrink-0 space-y-6 sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto overflow-x-hidden">
        {/* Selected Paragraph Details */}
        {selectedParagraph && (
          <>
            <div className="bg-white border border-gray-200 rounded-[10px] p-4">
              <h4 className="text-[16px] font-medium leading-6 -tracking-[0.3125px] text-[#101828] mb-3">
                분석 근거
              </h4>
              <p className="text-[#364153] text-[14px] leading-5">
                {selectedParagraph.reasoning}
              </p>
            </div>
            {(selectedParagraph.linkDigests && selectedParagraph.linkDigests.length > 0) || selectedParagraph.sources.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-[10px] p-4">
                <h4 className="text-[16px] font-medium leading-6 -tracking-[0.3125px] text-[#101828] mb-3">
                  출처
                </h4>
                <div className="space-y-3">
                  {selectedParagraph.linkDigests && selectedParagraph.linkDigests.length > 0 ? (
                    deduplicateByHostname(selectedParagraph.linkDigests).map((digest, idx) => {
                      let hostname = digest.url;
                      let displayUrl = digest.url;
                      try {
                        const parsed = new URL(digest.url);
                        hostname = parsed.hostname.replace(/^www\./, "");
                        displayUrl =
                          `${hostname}${parsed.pathname}${parsed.search}`.replace(/\/$/, "") ||
                          hostname;
                      } catch {
                        hostname = digest.url;
                        displayUrl = digest.url;
                      }

                      return (
                        <a
                          key={idx}
                          href={digest.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group grid grid-cols-[40px_1fr_auto] items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-[0_12px_28px_-10px_rgba(15,23,42,0.35)]"
                        >
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
                            alt={`${hostname} favicon`}
                            width={32}
                            height={32}
                            className="h-10 w-10 rounded-full bg-white shadow-sm"
                          />

                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-[14px] font-medium leading-5 text-[#101828] transition-colors group-hover:text-[#155DFC] truncate">
                              {digest.title || hostname}
                            </p>

                            <p className="text-[12px] uppercase tracking-[0.08em] text-[#98A2B3] truncate" title={digest.url}>
                              {displayUrl}
                            </p>
                          </div>

                          <span className="ml-auto text-[#98A2B3] transition-transform group-hover:translate-x-1">
                            →
                          </span>
                        </a>
                      );
                    })
                  ) : (
                    deduplicateByHostname(selectedParagraph.sources).map((source, idx) => {
                      let hostname = source;
                      let displayUrl = source;
                      try {
                        const parsed = new URL(source);
                        hostname = parsed.hostname.replace(/^www\./, "");
                        displayUrl =
                          `${hostname}${parsed.pathname}${parsed.search}`.replace(/\/$/, "") ||
                          hostname;
                      } catch {
                        hostname = source;
                        displayUrl = source;
                      }

                      return (
                        <a
                          key={idx}
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group grid grid-cols-[40px_1fr_auto] items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-[0_12px_28px_-10px_rgba(15,23,42,0.35)]"
                        >
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
                            alt={`${hostname} favicon`}
                            width={32}
                            height={32}
                            className="h-10 w-10 rounded-full bg-white shadow-sm"
                          />

                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-[14px] font-medium leading-5 text-[#101828] truncate transition-colors group-hover:text-[#155DFC]">
                              {hostname}
                            </p>
                            <p className="text-[12px] uppercase tracking-[0.08em] text-[#98A2B3] truncate" title={source}>
                              {displayUrl}
                            </p>
                          </div>

                          <span className="ml-auto text-[#98A2B3] transition-transform group-hover:translate-x-1">
                            →
                          </span>
                        </a>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// Helper function to deduplicate URLs by hostname
function deduplicateByHostname<T extends { url: string } | string>(items: T[]): T[] {
  const seenHostnames = new Set<string>();
  return items.filter((item) => {
    const url = typeof item === 'string' ? item : item.url;
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      if (seenHostnames.has(hostname)) {
        return false;
      }
      seenHostnames.add(hostname);
      return true;
    } catch {
      // If URL parsing fails, keep the item
      return true;
    }
  });
}
