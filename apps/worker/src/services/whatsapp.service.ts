export class WhatsAppService {
  static buildUrl(phone: string, message: string): string {
    const cleanPhone = phone.replace(/\s+/g, '');
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encoded}`;
  }
}
