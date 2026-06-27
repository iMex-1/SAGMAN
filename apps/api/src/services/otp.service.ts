import crypto from 'crypto'

export class OtpService {
  /**
   * Generate a cryptographically secure 6-digit OTP
   */
  static generate(): string {
    // Generate a random number between 100000 and 999999
    const otp = crypto.randomInt(100000, 999999)
    return otp.toString()
  }

  /**
   * Get expiry date (10 minutes from now)
   */
  static getExpiry(): Date {
    const expiry = new Date()
    expiry.setMinutes(expiry.getMinutes() + 10)
    return expiry
  }

  /**
   * Check if OTP is still valid
   */
  static isValid(
    storedOtp: string | null,
    storedExpiry: Date | null,
    submittedOtp: string,
  ): boolean {
    if (!storedOtp || !storedExpiry) return false
    if (new Date() > storedExpiry) return false
    return storedOtp === submittedOtp
  }
}
