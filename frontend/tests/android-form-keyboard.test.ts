import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const formScreens = [
  'app/(auth)/login.tsx',
  'app/(auth)/otp-verification.tsx',
  'app/(auth)/register-buyer.tsx',
  'app/(auth)/register-seller.tsx',
  'app/(buyer)/gics.tsx',
  'app/(buyer)/prefinancing.tsx',
  'app/(seller)/agronomist.tsx',
  'app/(seller)/b2b-trade.tsx',
  'app/(seller)/growth-log.tsx',
  'app/(seller)/home.tsx',
  'app/(seller)/profile.tsx',
];

describe('formulaires Android', () => {
  it.each(formScreens)('n’utilise pas KeyboardAvoidingView height dans une modale ou un formulaire : %s', (screen) => {
    const source = readFileSync(join(process.cwd(), 'src', screen), 'utf8');
    expect(source).not.toContain("Platform.OS === 'ios' ? 'padding' : 'height'");
  });
});
