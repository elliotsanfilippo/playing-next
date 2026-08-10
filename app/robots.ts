import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dj/",
        "/api/",
        "/request/*/confirmation",
        "/request/*/my-requests",
        "/request/*/queue",
      ],
    },
    host: "https://playingnextapp.com",
  };
}
