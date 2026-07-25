/**
 * Local solar calculations — no network required.
 *
 * SMHI's forecast API provides neither sunrise/sunset times nor a UV index,
 * so we derive both here from the observer's latitude/longitude and the clock:
 *   - Sunrise/sunset: found by scanning the day for the horizon crossing.
 *   - UV index: a Madronich-type clear-sky estimate from solar elevation,
 *     attenuated by the forecast's cloud cover.
 *
 * The UV figure is an approximation (assumes ~300 DU ozone, sea level) — good
 * enough for an at-a-glance dashboard, not for sun-safety decisions.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Standard sun altitude for sunrise/sunset (accounts for refraction + solar disc). */
const HORIZON_DEG = -0.833;

function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Solar elevation angle (degrees above the horizon) at a given instant and place.
 * Low-precision NOAA formulae — accurate to well within a degree, plenty for us.
 */
export function solarElevation(date: Date, latDeg: number, lonDeg: number): number {
  const n = julianDay(date) - 2451545.0; // days since J2000.0
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
  const localSidereal = (gmst + lonDeg) * RAD;
  const hourAngle = localSidereal - rightAscension;

  const lat = latDeg * RAD;
  const elevation = Math.asin(
    Math.sin(lat) * Math.sin(declination) +
      Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
  );
  return elevation * DEG;
}

export interface SunTimes {
  /** null during polar night / midnight sun (no crossing that day). */
  sunrise: Date | null;
  sunset: Date | null;
}

/**
 * Sunrise and sunset for the local calendar day containing `date`, found by
 * scanning elevation minute-by-minute for the horizon crossing. Returns nulls
 * when the sun never crosses the horizon that day (high-latitude summer/winter).
 */
export function sunTimes(date: Date, latDeg: number, lonDeg: number): SunTimes {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  let sunrise: Date | null = null;
  let sunset: Date | null = null;
  let prev = solarElevation(start, latDeg, lonDeg);

  for (let minute = 1; minute <= 1440; minute++) {
    const t = new Date(start.getTime() + minute * 60000);
    const elevation = solarElevation(t, latDeg, lonDeg);
    if (!sunrise && prev < HORIZON_DEG && elevation >= HORIZON_DEG) sunrise = t;
    if (sunrise && !sunset && prev >= HORIZON_DEG && elevation < HORIZON_DEG) sunset = t;
    prev = elevation;
  }

  return { sunrise, sunset };
}

/**
 * Clear-sky UV index from solar elevation (Madronich-type parameterisation).
 * Zero when the sun is at or below the horizon.
 */
export function clearSkyUvIndex(elevationDeg: number): number {
  if (elevationDeg <= 0) return 0;
  const zenith = (90 - elevationDeg) * RAD;
  return Math.max(0, 12.5 * Math.pow(Math.cos(zenith), 2.42));
}

/**
 * UV index for the actual sky: clear-sky value reduced by cloud cover.
 * @param elevationDeg   solar elevation in degrees
 * @param cloudFraction  cloud cover, 0–100 (%)
 */
export function uvIndex(elevationDeg: number, cloudFraction: number): number {
  const clouds = Math.min(1, Math.max(0, cloudFraction / 100));
  const transmission = 1 - 0.7 * clouds * clouds; // overcast keeps ~30% of UV
  return clearSkyUvIndex(elevationDeg) * transmission;
}
