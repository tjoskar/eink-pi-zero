/**
 * Where the Framework's non-code assets (fonts/, python/) live.
 *
 * They ship next to the code, so they are resolved from this module rather
 * than from the working directory. This file is two levels below the package
 * root both as source (src/assets/) and when built (dist/assets/).
 *
 * The Dashboard bundle (dist/home-dashboard/main.js on the Pi) sits at the
 * same depth, so there the root is the deploy directory, which holds fonts/
 * and python/.
 */
import { join } from "node:path";

const PACKAGE_ROOT = join(import.meta.dirname, "..", "..");

export const FONT_DIR = join(PACKAGE_ROOT, "fonts");
export const PYTHON_DIR = join(PACKAGE_ROOT, "python");
