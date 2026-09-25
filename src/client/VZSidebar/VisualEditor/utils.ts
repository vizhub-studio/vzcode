import { hcl } from 'd3-color';

// Helper function to calculate percentage for progress fill
export const calculatePercentage = (
  value: number,
  min: number,
  max: number,
) => {
  return ((value - min) / (max - min)) * 100;
};

// Helper function to format values nicely
export const formatValue = (
  value: number,
  min: number,
  max: number,
) => {
  // Determine decimal places based on the range
  const range = max - min;
  const decimalPlaces =
    range < 10 ? 2 : range < 100 ? 1 : 0;
  return Number(value).toFixed(decimalPlaces);
};

// Helper function to check if HCL color is displayable
export const hclOk = (
  h: number,
  c: number,
  l: number,
): boolean => {
  try {
    const color = hcl(h, c, l);
    return color.displayable();
  } catch {
    return false;
  }
};

// Helper function to render slider background gradients
export const renderSliderBackground = (
  canvas: HTMLCanvasElement | null,
  channel: 'h' | 'c' | 'l',
  values: { h: number; c: number; l: number },
): void => {
  if (!canvas) return;

  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.createImageData(width, height);

  for (let x = 0; x < width; x++) {
    let h, c, l;

    // Map x pixel to value in slider domain
    if (channel === 'h') {
      const val = (x * 360) / (width - 1);
      h = val;
      c = Math.max(0, Math.min(values.c, 100));
      l = Math.max(0, Math.min(values.l, 100));
    } else if (channel === 'c') {
      const val = (x * 100) / (width - 1);
      h = Math.max(0, Math.min(values.h, 360));
      c = val;
      l = Math.max(0, Math.min(values.l, 100));
    } else {
      // channel === 'l'
      const val = (x * 100) / (width - 1);
      h = Math.max(0, Math.min(values.h, 360));
      c = Math.max(0, Math.min(values.c, 100));
      l = val;
    }

    // Determine display color
    let displayColor;
    if (hclOk(h, c, l)) {
      const hclColor = hcl(h, c, l);
      const rgbColor = hclColor.rgb();
      displayColor = {
        r: rgbColor.r,
        g: rgbColor.g,
        b: rgbColor.b,
      };
    } else {
      // Out-of-gamut: show gray
      displayColor = { r: 128, g: 128, b: 128 };
    }

    // Fill the column
    for (let y = 0; y < height; y++) {
      const i = 4 * (y * width + x);
      imageData.data[i] = displayColor.r;
      imageData.data[i + 1] = displayColor.g;
      imageData.data[i + 2] = displayColor.b;
      imageData.data[i + 3] = 255; // Alpha
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

// Helper function to get nested property value using dot notation
export const getNestedProperty = <T = unknown>(
  obj: Record<string, unknown>,
  path: string,
): T | undefined => {
  // Validate path to prevent empty strings, consecutive dots, or leading/trailing dots
  if (
    !path ||
    path.includes('..') ||
    path.startsWith('.') ||
    path.endsWith('.')
  ) {
    return undefined;
  }

  const keys = path.split('.');
  let value: unknown = obj;
  for (const key of keys) {
    // Skip empty keys that might result from splitting
    if (!key) {
      return undefined;
    }
    if (value === null || value === undefined) {
      return undefined;
    }
    // Type guard to ensure value is an object before accessing property
    if (typeof value !== 'object') {
      return undefined;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return value as T | undefined;
};

// Helper function to set nested property value using dot notation
export const setNestedProperty = <
  T extends Record<string, unknown>,
>(
  obj: T,
  path: string,
  value: unknown,
): T => {
  // Validate path to prevent empty strings, consecutive dots, or leading/trailing dots
  if (
    !path ||
    path.includes('..') ||
    path.startsWith('.') ||
    path.endsWith('.')
  ) {
    throw new Error(
      `Invalid property path "${path}" - path cannot be empty, contain consecutive dots, or have leading/trailing dots`,
    );
  }

  const keys = path.split('.');

  // Check for empty keys
  if (keys.some((key) => !key)) {
    throw new Error(
      `Invalid property path "${path}" - path contains empty segments`,
    );
  }

  const newObj = { ...obj };
  let current: Record<string, unknown> = newObj;

  // List of dangerous keys that could lead to prototype pollution
  const dangerousKeys = [
    '__proto__',
    'constructor',
    'prototype',
  ];

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];

    // Guard against prototype pollution
    if (dangerousKeys.includes(key)) {
      throw new Error(
        `Cannot set property "${key}" - potential prototype pollution`,
      );
    }

    // Create nested object if it doesn't exist or isn't a plain object
    if (
      current[key] == null ||
      typeof current[key] !== 'object' ||
      Array.isArray(current[key])
    ) {
      current[key] = {};
    } else {
      // Clone the nested object to avoid mutation
      current[key] = {
        ...(current[key] as Record<string, unknown>),
      };
    }
    current = current[key] as Record<string, unknown>;
  }

  // Guard against prototype pollution for the final key
  const finalKey = keys[keys.length - 1];
  if (dangerousKeys.includes(finalKey)) {
    throw new Error(
      `Cannot set property "${finalKey}" - potential prototype pollution`,
    );
  }

  // Set the final value
  current[finalKey] = value;

  return newObj;
};
