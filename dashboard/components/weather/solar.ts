/**
 * Sun position, computed locally: SMHI's forecast has no sunrise or sunset.
 *
 * Low-precision NOAA formulae, well within a minute of the published times
 * at Swedish latitudes.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Sun altitude at sunrise and sunset: refraction plus the solar disc. */
const HORIZON_DEG = -0.833;

/** Solar elevation (degrees above the horizon) at an instant and place. */
function solarElevation(date: Date, latDeg: number, lonDeg: number): number {
  const n = date.getTime() / 86_400_000 + 2440587.5 - 2451545.0; // days since J2000.0
  const meanLong = (280.46 + 0.9856474 * n) % 360;
  const meanAnom = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const eclipticLong =
    (meanLong + 1.915 * Math.sin(meanAnom) + 0.02 * Math.sin(2 * meanAnom)) * RAD;
  const obliquity = (23.439 - 0.0000004 * n) * RAD;

  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLong));
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLong),
    Math.cos(eclipticLong),
  );

  const gmst = (280.46061837 + 360.98564736629 * n) % 360; // Greenwich sidereal time
  const hourAngle = (gmst + lonDeg) * RAD - rightAscension;

  const lat = latDeg * RAD;
  const elevation = Math.asin(
    Math.sin(lat) * Math.sin(declination) +
      Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
  );
  return elevation * DEG;
}

/** Whether the sun is above the horizon: between sunrise and sunset. */
export function isSunUp(date: Date, latDeg: number, lonDeg: number): boolean {
  return solarElevation(date, latDeg, lonDeg) >= HORIZON_DEG;
}

export interface SunTimes {
  /** null when the sun does not cross the horizon that day (polar night, midnight sun). */
  sunrise: Date | null;
  sunset: Date | null;
}

/** Sunrise and sunset on the local calendar day of `date`, to the minute. */
export function sunTimes(date: Date, latDeg: number, lonDeg: number): SunTimes {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  let sunrise: Date | null = null;
  let sunset: Date | null = null;
  let wasUp = isSunUp(start, latDeg, lonDeg);

  for (let minute = 1; minute <= 1440; minute++) {
    const t = new Date(start.getTime() + minute * 60_000);
    const up = isSunUp(t, latDeg, lonDeg);
    if (!sunrise && !wasUp && up) sunrise = t;
    if (sunrise && !sunset && wasUp && !up) sunset = t;
    wasUp = up;
  }

  return { sunrise, sunset };
}
