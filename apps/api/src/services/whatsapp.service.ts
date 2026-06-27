/**
 * WhatsApp notification service.
 * Builds wa.me URLs with pre-filled messages. No API integration.
 * Manager reviews and sends manually.
 */

export interface WaAppointmentConfirmData {
  clientName: string
  date: string          // e.g., "Lundi 01/07/2026"
  time: string          // e.g., "09:00"
  vehicleMakeModel: string
  matricule: string
  purpose: string
  garagePhone: string
}

export interface WaDiagnosisData {
  clientName: string
  vehicleMakeModel: string
  matricule: string
  diagnosisDate: string
  issues: Array<{ description: string; severity: string }>
  recommendedRepairs: string
  estimatedCost: number
  estimatedDays: number
  garagePhone: string
  currencyLabel?: string
}

export interface WaReadyData {
  clientName: string
  vehicleMakeModel: string
  matricule: string
  repairSummary: string
  totalAmount: number
  garagePhone: string
  currencyLabel?: string
}

export class WhatsAppService {
  static buildUrl(phone: string, message: string): string {
    // Ensure E.164 format
    const cleanPhone = phone.replace(/\s+/g, '')
    const encoded = encodeURIComponent(message)
    return `https://wa.me/${cleanPhone}?text=${encoded}`
  }

  static t01AppointmentConfirmation(data: WaAppointmentConfirmData, phone: string): string {
    const message = `Bonjour ${data.clientName},

Votre rendez-vous au Garage Sagman est confirmé.

📅 Date : ${data.date}
⏰ Heure : ${data.time}
🚗 Véhicule : ${data.vehicleMakeModel} — ${data.matricule}
🔧 Motif : ${data.purpose}

Merci de vous présenter à l'heure.
Pour toute question : ${data.garagePhone}

Garage Sagman`
    return this.buildUrl(phone, message)
  }

  static t02AppointmentRescheduled(
    clientName: string,
    newDate: string,
    newTime: string,
    vehicleMakeModel: string,
    matricule: string,
    garagePhone: string,
    phone: string,
  ): string {
    const message = `Bonjour ${clientName},

Votre rendez-vous a été déplacé.

📅 Nouvelle date : ${newDate}
⏰ Nouvelle heure : ${newTime}
🚗 Véhicule : ${vehicleMakeModel} — ${matricule}

Nous nous excusons pour la gêne occasionnée.
Contact : ${garagePhone}

Garage Sagman`
    return this.buildUrl(phone, message)
  }

  static t03DiagnosisResults(data: WaDiagnosisData, phone: string): string {
    const issuesList = data.issues
      .map((i) => `• ${i.description} — Gravité : ${i.severity}`)
      .join('\n')
    const currency = data.currencyLabel ?? 'DH'

    const message = `Bonjour ${data.clientName},

Le diagnostic de votre véhicule est terminé.

🚗 Véhicule : ${data.vehicleMakeModel} — ${data.matricule}
📆 Date du diagnostic : ${data.diagnosisDate}

PROBLÈMES IDENTIFIÉS :
${issuesList}

TRAVAUX RECOMMANDÉS :
• ${data.recommendedRepairs}

💰 Estimation : ${data.estimatedCost} ${currency}
⏱ Durée estimée : ${data.estimatedDays} jours

Merci de nous confirmer votre accord pour procéder.
Contact : ${data.garagePhone}

Garage Sagman`
    return this.buildUrl(phone, message)
  }

  static t04CarReady(data: WaReadyData, phone: string): string {
    const currency = data.currencyLabel ?? 'DH'
    const message = `Bonjour ${data.clientName},

Votre véhicule est prêt à être récupéré.

🚗 Véhicule : ${data.vehicleMakeModel} — ${data.matricule}
🔧 Travaux effectués : ${data.repairSummary}
💰 Montant à régler : ${data.totalAmount} ${currency}

Vous pouvez passer le récupérer pendant nos heures d'ouverture.
Contact : ${data.garagePhone}

Garage Sagman`
    return this.buildUrl(phone, message)
  }

  static t05Invoice(
    clientName: string,
    phone: string,
    invoiceData: {
      invoiceNumber: string
      date: string
      clientPhone: string
      vehicleMakeModel: string
      matricule: string
      laborItems: Array<{ description: string; cost: number }>
      parts: Array<{ name: string; qty: number; unitCost: number; total: number }>
      partsTotal: number
      laborTotal: number
      discount: number
      grandTotal: number
      amountReceived: number
      changeDue: number
      mechanicNames: string
      managerName: string
      garageAddress: string
      garagePhone: string
      currencyLabel?: string
    },
  ): string {
    const currency = invoiceData.currencyLabel ?? 'DH'
    const laborLines = invoiceData.laborItems
      .map((l) => `• ${l.description} .............. ${l.cost} ${currency}`)
      .join('\n')
    const partLines = invoiceData.parts
      .map((p) => `• ${p.name} × ${p.qty} ................. ${p.total} ${currency}`)
      .join('\n')

    const message = `Bonjour ${clientName},

Voici votre reçu pour les travaux effectués.

════════════════════════
    FACTURE SAGMAN
════════════════════════
N° : ${invoiceData.invoiceNumber}          Date : ${invoiceData.date}

Client : ${clientName}
Tél.   : ${invoiceData.clientPhone}
Véhicule : ${invoiceData.vehicleMakeModel}
Matricule : ${invoiceData.matricule}

MAIN D'ŒUVRE :
${laborLines}

PIÈCES :
${partLines}

────────────────────────
PARTS TOTAL     ${invoiceData.partsTotal} ${currency}
LABOR TOTAL     ${invoiceData.laborTotal} ${currency}
DISCOUNT        ${invoiceData.discount} ${currency}
GRAND TOTAL     ${invoiceData.grandTotal} ${currency}
Reçu            ${invoiceData.amountReceived} ${currency}
Rendu           ${invoiceData.changeDue} ${currency}
────────────────────────

Mécanicien : ${invoiceData.mechanicNames}
Responsable : ${invoiceData.managerName}

Merci de votre confiance.
Garage Sagman — ${invoiceData.garageAddress} — ${invoiceData.garagePhone}
════════════════════════`
    return this.buildUrl(phone, message)
  }
}
