import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to TruAI
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Next.js 14 + shadcn/ui + Tailwind CSS 환경 설정이 완료되었습니다.
        </p>

        <div className="flex flex-wrap gap-4 items-center justify-center mt-4">
          <Button>Default Button</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>

        <div className="flex flex-wrap gap-4 items-center justify-center mt-4">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>

        <div className="mt-8 p-6 border rounded-lg bg-card text-card-foreground max-w-2xl">
          <h2 className="text-2xl font-semibold mb-4">설치된 기술 스택</h2>
          <ul className="text-left space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              Next.js 14.2.33 (App Router)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              TypeScript 5
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              Tailwind CSS 3.4.1
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              shadcn/ui (with Button component)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              ESLint
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
