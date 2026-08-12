import {
  WEBFOOT_SOLE_PATH,
  WEBFOOT_TOES,
  WEBFOOT_VIEWBOX_SIZE,
} from "./webfootFootprintGeometry";

describe("authoritative Webfoot footprint geometry", () => {
  it("contains the 64-unit sole and exactly four toe ellipses", () => {
    expect(WEBFOOT_VIEWBOX_SIZE).toBe(64);
    expect(WEBFOOT_SOLE_PATH).toBe(
      "M35.4 18.3c9.8-.4 17.8 6.4 17.2 15.3-.5 7.7-6.2 12-11.7 15.7-5.6 3.8-10 7.1-10.8 13.1-7.1-3-13.7-8.9-15.4-17.3-2.8-13.4 6.6-26.1 20.7-26.8Z",
    );
    expect(WEBFOOT_TOES).toHaveLength(4);
  });

  it("retains the source ellipse measurements and rotations", () => {
    expect(WEBFOOT_TOES).toEqual([
      { cx: 47.5, cy: 10.5, rx: 7.2, ry: 9.8, rotation: 18 },
      { cx: 34.7, cy: 11.4, rx: 5.6, ry: 7.8, rotation: 14 },
      { cx: 24.6, cy: 16.5, rx: 4.7, ry: 6.4, rotation: 13 },
      { cx: 17.4, cy: 23.9, rx: 3.9, ry: 5.4, rotation: 13 },
    ]);
  });
});
