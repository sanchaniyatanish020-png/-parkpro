import { BIOMETRIC_KEY } from '@/lib/settings'
import type { Role } from '@/types'

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i])
  return btoa(out)
}

function base64ToBuffer(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function readStore(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(BIOMETRIC_KEY) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, string>) {
  localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(store))
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false
    const fn = PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    if (!fn) return false
    return await fn.call(PublicKeyCredential)
  } catch {
    return false
  }
}

export function hasBiometricEnrolled(role: Role): boolean {
  return Boolean(readStore()[role])
}

/**
 * Registers a device-bound platform credential. Verification happens against
 * the local credential id; a production build should verify the assertion
 * signature on the server.
 */
export async function enrollBiometric(role: Role): Promise<boolean> {
  if (!(await biometricAvailable())) return false
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const userId = crypto.getRandomValues(new Uint8Array(16))
    const label = role === 'owner' ? 'ParkPro owner' : 'ParkPro staff'
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'ParkPro', id: location.hostname },
        user: { id: userId, name: `${role}@parkpro.local`, displayName: label },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 45_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null

    if (!credential) return false
    const store = readStore()
    store[role] = bufferToBase64(credential.rawId)
    writeStore(store)
    return true
  } catch {
    return false
  }
}

export async function verifyBiometric(role: Role): Promise<boolean> {
  const credentialId = readStore()[role]
  if (!credentialId) return false
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 45_000,
        userVerification: 'required',
        allowCredentials: [{ type: 'public-key', id: base64ToBuffer(credentialId) as BufferSource }],
      },
    })
    return Boolean(assertion)
  } catch {
    return false
  }
}

export function forgetBiometric(role: Role) {
  const store = readStore()
  delete store[role]
  writeStore(store)
}
