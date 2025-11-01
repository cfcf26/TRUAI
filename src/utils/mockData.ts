import { AnalyzedContent, ConfidenceLevel } from "@/types/content";

function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function getMockAnalyzedContent(): AnalyzedContent {
  const paragraphs = [
    {
      id: 1,
      content: "인공지능(AI)은 최근 몇 년간 급격한 발전을 이루었습니다. [OpenAI의 GPT-4](https://openai.com)는 자연어 처리 분야에서 혁신적인 성과를 보여주었으며, 다양한 산업 분야에 적용되고 있습니다.",
      confidence: 92,
      confidenceLevel: "high" as ConfidenceLevel,
      sources: ["https://openai.com"],
      reasoning: "공식 출처 링크가 확인되었으며 널리 인정된 사실입니다."
    },
    {
      id: 2,
      content: "머신러닝 기술의 발전으로 인해 의료 진단의 정확도가 크게 향상되었습니다. [Nature 저널의 연구](https://nature.com/articles/ai-medical)에 따르면, AI 기반 진단 시스템은 특정 질병에 대해 전문의와 유사하거나 더 높은 정확도를 보인다고 합니다.",
      confidence: 88,
      confidenceLevel: "high" as ConfidenceLevel,
      sources: ["https://nature.com/articles/ai-medical"],
      reasoning: "저명한 학술 저널 Nature의 연구 결과를 인용하고 있습니다."
    },
    {
      id: 3,
      content: "그러나 일각에서는 AI가 2025년까지 모든 인간의 일자리를 대체할 것이라는 주장도 제기되고 있습니다. 이러한 극단적인 예측은 신중하게 검토될 필요가 있습니다.",
      confidence: 35,
      confidenceLevel: "low" as ConfidenceLevel,
      sources: [],
      reasoning: "출처가 명시되지 않았으며, 극단적인 주장으로 학계의 일반적 견해와 다릅니다."
    },
    {
      id: 4,
      content: "[MIT Technology Review](https://technologyreview.com)는 AI 윤리와 규제의 중요성을 강조하며, 책임감 있는 AI 개발의 필요성을 역설하고 있습니다. 특히 개인정보 보호와 편향성 문제는 해결해야 할 주요 과제입니다.",
      confidence: 90,
      confidenceLevel: "high" as ConfidenceLevel,
      sources: ["https://technologyreview.com"],
      reasoning: "MIT Technology Review는 신뢰할 수 있는 기술 전문 매체입니다."
    },
    {
      id: 5,
      content: "양자 컴퓨팅과 AI의 결합은 향후 10년 내에 현재의 슈퍼컴퓨터보다 1000배 빠른 처리 속도를 달성할 것으로 예상됩니다. [IBM의 발표](https://ibm.com/quantum)에 따르면 양자 우위(Quantum Supremacy)를 통해 복잡한 문제 해결이 가능해질 것입니다.",
      confidence: 65,
      confidenceLevel: "medium" as ConfidenceLevel,
      sources: ["https://ibm.com/quantum"],
      reasoning: "IBM의 공식 발표이지만, 구체적인 시기와 성능 예측은 검증이 필요합니다."
    },
    {
      id: 6,
      content: "교육 분야에서도 AI의 활용이 증가하고 있습니다. 맞춤형 학습 플랫폼은 학생 개개인의 학습 속도와 스타일에 맞춰 콘텐츠를 제공하여 학습 효율을 높이고 있습니다.",
      confidence: 78,
      confidenceLevel: "medium" as ConfidenceLevel,
      sources: [],
      reasoning: "일반적으로 알려진 사실이지만 구체적인 출처가 명시되지 않았습니다."
    }
  ];

  return {
    title: "인공지능의 발전과 미래",
    paragraphs: paragraphs.map(p => ({
      ...p,
      confidenceLevel: getConfidenceLevel(p.confidence)
    }))
  };
}
