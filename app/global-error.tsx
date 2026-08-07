"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: "#070809",
          color: "#ffffff",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>
            Something went wrong
          </h1>

          <p style={{ marginTop: "0.75rem", color: "#a1a1aa" }}>
            We&apos;ve been notified and are looking into it.
          </p>

          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              background: "#ffffff",
              color: "#000000",
              fontWeight: 600,
              padding: "0.75rem 1.5rem",
              borderRadius: "1rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
