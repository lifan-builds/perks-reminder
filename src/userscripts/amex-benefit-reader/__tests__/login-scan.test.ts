// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import { watchAmexLogin } from "../login-scan";

describe("automatic login refresh", () => {
  let stop: () => void;
  const location = { origin: "https://global.americanexpress.com", pathname: "/account-overview" };
  const account = () => { document.body.innerHTML = '<button data-testid="simple_switcher_combobox" role="combobox">Synthetic card</button>'; };
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.replaceChildren();
    location.pathname = "/account-overview";
  });
  afterEach(() => { stop?.(); jest.useRealTimers(); });

  it("starts immediately when the signed-in account UI is already present", () => {
    account();
    const scan = jest.fn().mockResolvedValue(undefined);
    stop = watchAmexLogin({ scan, cancel: jest.fn(), isBusy: () => false, location });
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it("waits for sign-in, scans once, and ignores page rendering and focus events", async () => {
    const scan = jest.fn().mockResolvedValue(undefined);
    stop = watchAmexLogin({ scan, cancel: jest.fn(), isBusy: () => false, location });
    jest.advanceTimersByTime(2000);
    expect(scan).not.toHaveBeenCalled();
    account();
    await Promise.resolve();
    jest.advanceTimersByTime(100);
    expect(scan).toHaveBeenCalledTimes(1);
    document.body.append(document.createElement("div"));
    window.dispatchEvent(new Event("focus"));
    jest.advanceTimersByTime(10000);
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it("cancels at logout and scans the next login even in the same document", () => {
    const scan = jest.fn().mockResolvedValue(undefined);
    const cancel = jest.fn();
    account();
    stop = watchAmexLogin({ scan, cancel, isBusy: () => false, location });
    jest.advanceTimersByTime(100);
    location.pathname = "/authentication/logout";
    jest.advanceTimersByTime(1000);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(scan).toHaveBeenCalledTimes(1);
    location.pathname = "/account-overview";
    jest.advanceTimersByTime(1000);
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it("does not duplicate a manual scan or loop after a failed scan", async () => {
    let busy = true;
    const scan = jest.fn().mockRejectedValue(new Error("synthetic failure"));
    account();
    stop = watchAmexLogin({ scan, cancel: jest.fn(), isBusy: () => busy, location });
    jest.advanceTimersByTime(100);
    busy = false;
    jest.advanceTimersByTime(2000);
    expect(scan).not.toHaveBeenCalled();
    location.pathname = "/login";
    jest.advanceTimersByTime(1000);
    location.pathname = "/account-overview";
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    jest.advanceTimersByTime(10000);
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it("does not scan a login route with an old account selector, and stops cleanly", () => {
    const scan = jest.fn().mockResolvedValue(undefined);
    account();
    location.pathname = "/myca/logon/us/action";
    stop = watchAmexLogin({ scan, cancel: jest.fn(), isBusy: () => false, location });
    jest.advanceTimersByTime(2000);
    expect(scan).not.toHaveBeenCalled();
    stop();
    location.pathname = "/account-overview";
    jest.advanceTimersByTime(2000);
    expect(scan).not.toHaveBeenCalled();
  });
});
