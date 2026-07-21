import { describe, it, expect } from "vitest";
import { safeInternalPath } from "@/lib/paths";

// The auth callback interpolates `next` after the origin — everything here
// exists so a crafted magic-link URL can never bounce a client off-site.
describe("safeInternalPath", () => {
  it("passes ordinary internal paths through", () => {
    expect(safeInternalPath("/portal")).toBe("/portal");
    expect(safeInternalPath("/portal/studio")).toBe("/portal/studio");
    expect(safeInternalPath("/portal?tab=approvals")).toBe("/portal?tab=approvals");
  });

  it("falls back on empty / missing input", () => {
    expect(safeInternalPath(null)).toBe("/portal");
    expect(safeInternalPath(undefined)).toBe("/portal");
    expect(safeInternalPath("")).toBe("/portal");
    expect(safeInternalPath("   ")).toBe("/portal");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeInternalPath("//evil.com")).toBe("/portal");
    expect(safeInternalPath("https://evil.com")).toBe("/portal");
    expect(safeInternalPath("http://evil.com/portal")).toBe("/portal");
  });

  it("rejects userinfo and backslash tricks", () => {
    // `${origin}@evil.com` would turn the host into userinfo
    expect(safeInternalPath("@evil.com")).toBe("/portal");
    // browsers normalize "/\" to "//" → protocol-relative
    expect(safeInternalPath("/\\evil.com")).toBe("/portal");
    expect(safeInternalPath("\\\\evil.com")).toBe("/portal");
  });

  it("rejects header-injection newlines", () => {
    expect(safeInternalPath("/portal\r\nSet-Cookie: x=y")).toBe("/portal");
  });

  it("honors a custom fallback", () => {
    expect(safeInternalPath("//evil.com", "/portal/studio")).toBe("/portal/studio");
  });
});
