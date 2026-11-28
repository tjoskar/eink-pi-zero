import { beforeEach, expect, test } from "vitest";
import { brokerConnected, brokerLost, isOffline, setHaStatus } from "./offline.tsx";

const at = (minutes: number) => new Date(2026, 10, 28, 12, minutes);

beforeEach(() => {
  brokerConnected();
  setHaStatus("online");
});

test("not offline while connected and Home Assistant is online", () => {
  expect(isOffline(at(30))).toBe(false);
});

test("a lost broker shows the mark only after more than 5 minutes", () => {
  brokerLost(at(0));
  expect(isOffline(at(5))).toBe(false);
  expect(isOffline(at(6))).toBe(true);
});

test("failed reconnects keep the time the broker was first lost", () => {
  brokerLost(at(0));
  brokerLost(at(4));
  expect(isOffline(at(6))).toBe(true);
});

test("reconnecting clears the mark and restarts the 5 minutes", () => {
  brokerLost(at(0));
  brokerConnected();
  expect(isOffline(at(10))).toBe(false);
  brokerLost(at(10));
  expect(isOffline(at(14))).toBe(false);
});

test("Home Assistant offline shows the mark at once, online clears it", () => {
  setHaStatus("offline");
  expect(isOffline(at(0))).toBe(true);
  setHaStatus("online");
  expect(isOffline(at(0))).toBe(false);
});

test("reconnecting forgets an offline Home Assistant, whose online may have been missed", () => {
  setHaStatus("offline");
  brokerLost(at(0));
  brokerConnected();
  expect(isOffline(at(1))).toBe(false);
});
