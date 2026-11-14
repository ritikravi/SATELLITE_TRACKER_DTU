/**
 * NORAD Two-Line Element (TLE) Format Validation & Orbital Parameter Extraction
 */

export function calculateTleChecksum(line: string): number {
  let sum = 0;
  // Calculate checksum over first 68 characters
  for (let i = 0; i < Math.min(68, line.length); i++) {
    const char = line[i];
    if (char >= '0' && char <= '9') {
      sum += parseInt(char, 10);
    } else if (char === '-') {
      sum += 1;
    }
  }
  return sum % 10;
}

export interface TleValidationResult {
  isValid: boolean;
  errors: string[];
  extracted?: {
    satelliteName: string;
    noradId: number;
    classification: string;
    intlDesignator: string;
    epochYear: number;
    epochDay: number;
    inclinationDeg: number;
    raanDeg: number;
    eccentricity: number;
    argPerigeeDeg: number;
    meanAnomalyDeg: number;
    meanMotionRevsDay: number;
  };
}

export function validateTle(satelliteName: string, line1: string, line2: string): TleValidationResult {
  const errors: string[] = [];
  const clean1 = line1.trim();
  const clean2 = line2.trim();

  if (!satelliteName.trim()) {
    errors.push('Satellite name is required.');
  }

  // Check Line 1
  if (!clean1.startsWith('1 ')) {
    errors.push('Line 1 must start with "1 ".');
  }
  if (clean1.length !== 69) {
    errors.push(`Line 1 length is ${clean1.length} chars (must be exactly 69 characters).`);
  } else {
    const expectedChecksum = parseInt(clean1[68], 10);
    const calculatedChecksum = calculateTleChecksum(clean1);
    if (expectedChecksum !== calculatedChecksum) {
      errors.push(`Line 1 checksum mismatch: calculated ${calculatedChecksum}, found ${expectedChecksum}.`);
    }
  }

  // Check Line 2
  if (!clean2.startsWith('2 ')) {
    errors.push('Line 2 must start with "2 ".');
  }
  if (clean2.length !== 69) {
    errors.push(`Line 2 length is ${clean2.length} chars (must be exactly 69 characters).`);
  } else {
    const expectedChecksum = parseInt(clean2[68], 10);
    const calculatedChecksum = calculateTleChecksum(clean2);
    if (expectedChecksum !== calculatedChecksum) {
      errors.push(`Line 2 checksum mismatch: calculated ${calculatedChecksum}, found ${expectedChecksum}.`);
    }
  }

  // Check matching NORAD ID
  if (clean1.length >= 7 && clean2.length >= 7) {
    const id1 = clean1.substring(2, 7).trim();
    const id2 = clean2.substring(2, 7).trim();
    if (id1 !== id2) {
      errors.push(`NORAD ID mismatch: Line 1 specifies #${id1}, but Line 2 specifies #${id2}.`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Extract parsed orbital elements
  try {
    const noradId = parseInt(clean1.substring(2, 7).trim(), 10);
    const classification = clean1[7];
    const intlDesignator = clean1.substring(9, 17).trim();
    const epochYear = parseInt(clean1.substring(18, 20).trim(), 10);
    const epochDay = parseFloat(clean1.substring(20, 32).trim());

    const inclinationDeg = parseFloat(clean2.substring(8, 16).trim());
    const raanDeg = parseFloat(clean2.substring(17, 25).trim());
    const eccentricity = parseFloat('0.' + clean2.substring(26, 33).trim());
    const argPerigeeDeg = parseFloat(clean2.substring(34, 42).trim());
    const meanAnomalyDeg = parseFloat(clean2.substring(43, 51).trim());
    const meanMotionRevsDay = parseFloat(clean2.substring(52, 63).trim());

    return {
      isValid: true,
      errors: [],
      extracted: {
        satelliteName: satelliteName.trim(),
        noradId,
        classification,
        intlDesignator,
        epochYear,
        epochDay,
        inclinationDeg,
        raanDeg,
        eccentricity,
        argPerigeeDeg,
        meanAnomalyDeg,
        meanMotionRevsDay
      }
    };
  } catch (e: any) {
    return {
      isValid: false,
      errors: [`Failed to parse orbital elements: ${e.message}`]
    };
  }
}

