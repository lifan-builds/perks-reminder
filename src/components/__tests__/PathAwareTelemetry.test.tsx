// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { render, screen } from "@testing-library/react";
import PathAwareTelemetry from "../PathAwareTelemetry";

const mockPathname = jest.fn(() => "/");
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));
jest.mock("next/script", () => function MockScript(props: { id?: string; src?: string }) {
  return <span data-testid={props.id ?? "script"} data-src={props.src} />;
});
jest.mock("@vercel/analytics/next", () => ({ Analytics: () => <span data-testid="vercel-analytics" /> }));

describe("pathname-aware telemetry", () => {
  const originalEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  beforeEach(() => {
    mockPathname.mockReturnValue("/");
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = originalEnv;
  });

  it.each([undefined, "preview", "development"])("loads zero telemetry outside a Vercel production deployment (%p)", (environment) => {
    if (environment === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    else process.env.NEXT_PUBLIC_VERCEL_ENV = environment;
    const { container } = render(<PathAwareTelemetry />);
    expect(container).toBeEmptyDOMElement();
  });

  it("loads cookieless first-party telemetry outside the private handoff without Google gtag", () => {
    render(<PathAwareTelemetry />);
    expect(screen.getByTestId("clifan-telemetry")).toHaveAttribute("data-src", "https://clifan-umami.vercel.app/script.js");
    expect(screen.queryByTestId("google-analytics-loader")).not.toBeInTheDocument();
    expect(screen.getByTestId("vercel-analytics")).toBeInTheDocument();
  });

  it("loads zero telemetry scripts on the exact handoff path", () => {
    mockPathname.mockReturnValue("/integrations/amex-sync");
    const { container } = render(<PathAwareTelemetry />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not suppress telemetry on a lookalike path", () => {
    mockPathname.mockReturnValue("/integrations/amex-sync-history");
    render(<PathAwareTelemetry />);
    expect(screen.getByTestId("clifan-telemetry")).toBeInTheDocument();
    expect(screen.getByTestId("vercel-analytics")).toBeInTheDocument();
  });
});
