"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, isLoggedIn } from "@/lib/auth";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/");
    }
  }, [router]);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await login();
      router.replace("/");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Agent Austin
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">by Katelyn Fritz</p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="rounded-lg bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Log In"}
        </button>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}
