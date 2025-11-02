"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnalyzedContent, ParagraphAnalysis } from "@/types/content";

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
        <div className="bg-white border border-gray-200 shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] rounded-[10px] p-12">
          {/* Title */}
          <h1 className="text-[28px] font-bold leading-[36px] text-[#0A0E14] mb-10 pb-4 border-b-2 border-gray-300 -tracking-[0.5px]">
            {content.title}
          </h1>

          {/* Paragraphs */}
          <div className="space-y-0">
            {content.paragraphs.map((paragraph) => (
              <div
                key={paragraph.id}
                className={`${paragraph.isHeading ? '' : 'p-3 rounded my-2'} ${getBackgroundColor(paragraph)}`}
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

                {/* Confidence Indicator - only show "분석 중" if confidence is 50 (initial state) and reasoning contains "분석하고 있습니다" */}
                {!paragraph.isHeading &&
                 selectedParagraph?.id === paragraph.id &&
                 paragraph.confidence === 50 &&
                 paragraph.reasoning.includes("분석하고 있습니다") && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                    <span className="text-[14px] leading-5 -tracking-[0.150391px]">
                      분석 중...
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-[384px] flex-shrink-0 space-y-6 sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto overflow-x-hidden">
        {/* Analysis Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-[10px] overflow-hidden">
          <div className="bg-white border-b border-gray-200 p-4">
            <h3 className="text-[18px] font-medium leading-[27px] -tracking-[0.439453px] text-[#101828]">
              신뢰도 분석
            </h3>
          </div>
          <div className="p-12 pt-16 text-center">
            <p className="text-[16px] leading-6 -tracking-[0.3125px] text-[#6A7282]">
              문단에 마우스를 올리거나
            </p>
            <p className="text-[16px] leading-6 -tracking-[0.3125px] text-[#6A7282] mt-0">
              클릭하여 분석 결과를 확인하세요
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white border border-gray-200 rounded-[10px] p-4 space-y-3">
          <h4 className="text-[16px] font-medium leading-6 -tracking-[0.3125px] text-[#101828]">
            신뢰도 범례
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-[#B9F8CF] border-2 border-[#7BF1A8] rounded" />
              <span className="text-[16px] leading-6 -tracking-[0.3125px] text-[#364153]">
                높음 (80-100)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-[#FFF085] border-2 border-[#FFDF20] rounded" />
              <span className="text-[16px] leading-6 -tracking-[0.3125px] text-[#364153]">
                보통 (50-79)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-[#FFC9C9] border-2 border-[#FFA2A2] rounded" />
              <span className="text-[16px] leading-6 -tracking-[0.3125px] text-[#364153]">
                낮음 (0-49)
              </span>
            </div>
          </div>
        </div>

        {/* Selected Paragraph Details */}
        {selectedParagraph && (
          <div className="bg-white border border-gray-200 rounded-[10px] p-4">
            <h4 className="text-[16px] font-medium leading-6 -tracking-[0.3125px] text-[#101828] mb-3">
              분석 상세
            </h4>
            <div className="space-y-3 text-sm">
              {/* Only show confidence score if paragraph is verified */}
              {!(selectedParagraph.confidence === 50 && selectedParagraph.reasoning.includes("분석하고 있습니다")) && (
                <div>
                  <p className="text-gray-600 mb-1">신뢰도 점수</p>
                  <p className="text-[16px] font-medium text-[#101828]">
                    {selectedParagraph.confidence}%
                  </p>
                </div>
              )}
              {selectedParagraph.sources.length > 0 && (
                <div>
                  <p className="text-gray-600 mb-1">출처</p>
                  <ul className="list-disc list-inside text-[#155DFC]">
                    {selectedParagraph.sources.map((source, idx) => (
                      <li key={idx}>
                        <a
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {source}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-gray-600 mb-1">분석 근거</p>
                <p className="text-[#364153] text-[14px] leading-5">
                  {selectedParagraph.reasoning}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
