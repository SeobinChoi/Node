import { signIn, devLoginEnabled } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

// callbackUrl은 신뢰할 수 없는 입력이다. 다중 인코딩/잘린 값이 들어오면
// signIn의 redirectTo에서 "Invalid URL"로 터지므로 안전한 경로로 정규화한다.
function sanitizeRedirect(raw?: string): string {
  if (!raw) return "/";

  // 여러 번 인코딩된 경우 안전하게 해제 (잘린 "%" 등은 예외 → 폴백)
  let value = raw;
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      return "/";
    }
  }

  // 절대 URL이면 같은 앱 내부 경로만 추출 (오픈 리다이렉트 차단)
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return `${url.pathname}${url.search}${url.hash}` || "/";
    } catch {
      return "/";
    }
  }

  // 상대 경로만 허용 ("//" 로 시작하는 프로토콜-상대 URL 차단)
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl } = await searchParams;
  const redirectTo = sanitizeRedirect(callbackUrl);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Node</CardTitle>
          <CardDescription>
            Sign in to manage your projects and track bottlenecks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: redirectTo });
            }}
          >
            <Button type="submit" className="w-full bg-brand hover:bg-brand/90 text-brand-foreground">
              Sign in with Google
            </Button>
          </form>

          {devLoginEnabled && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">개발 전용</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form
                action={async (formData: FormData) => {
                  "use server";
                  const email = formData.get("email");
                  await signIn("dev-login", {
                    email: typeof email === "string" ? email : "",
                    redirectTo,
                  });
                }}
                className="space-y-2"
              >
                <Label htmlFor="dev-email">이메일로 로그인 (비밀번호 없음)</Label>
                <Input
                  id="dev-email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <Button type="submit" variant="outline" className="w-full">
                  개발자 로그인
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
