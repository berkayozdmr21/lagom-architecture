const http = require("http");

const PUBLIC_PORT = Number(process.env.PUBLIC_PORT || 3001);
const PRIVATE_PORT = Number(process.env.PORT || 3000);

function blocked(pathname, method) {
  const publicInquiry = pathname === "/api/inquiries" && method === "POST";
  if (method !== "GET" && method !== "HEAD" && !publicInquiry) return true;
  return (
    pathname === "/admin" ||
    pathname === "/admin.html" ||
    pathname === "/admin.css" ||
    pathname === "/admin.js" ||
    pathname === "/YONETIM-PANELI.md" ||
    (pathname.startsWith("/api/") && pathname !== "/api/content" && !publicInquiry)
  );
}

http
  .createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (blocked(url.pathname, request.method)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return response.end("Bu sayfa dış erişime kapalıdır.");
    }

    const proxy = http.request(
      {
        hostname: "127.0.0.1",
        port: PRIVATE_PORT,
        path: request.url,
        method: request.method,
        headers: { ...request.headers, host: `127.0.0.1:${PRIVATE_PORT}` },
      },
      upstream => {
        response.writeHead(upstream.statusCode, upstream.headers);
        upstream.pipe(response);
      },
    );

    proxy.on("error", () => {
      response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Site sunucusuna ulaşılamıyor.");
    });
    request.pipe(proxy);
  })
  .listen(PUBLIC_PORT, "127.0.0.1", () => {
    console.log(`Güvenli paylaşım kapısı: http://127.0.0.1:${PUBLIC_PORT}`);
    console.log("Admin paneli dış erişime kapalıdır.");
  });
