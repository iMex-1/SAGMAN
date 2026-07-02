export interface WaAppointmentConfirmData {
  clientName: string;
  date: string;
  time: string;
  vehicleMakeModel: string;
  matricule: string;
  purpose: string;
  garagePhone: string;
}

export interface WaDiagnosisData {
  clientName: string;
  vehicleMakeModel: string;
  matricule: string;
  diagnosisDate: string;
  issues: Array<{ description: string; severity: string }>;
  recommendedRepairs: string;
  estimatedCost: number;
  estimatedDays: number;
  garagePhone: string;
  currencyLabel?: string;
}

export interface WaReadyData {
  clientName: string;
  vehicleMakeModel: string;
  matricule: string;
  repairSummary: string;
  totalAmount: number;
  garagePhone: string;
  currencyLabel?: string;
}

export class WhatsAppService {
  static buildUrl(phone: string, message: string): string {
    const cleanPhone = phone.replace(/\s+/g, '');
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encoded}`;
  }

  static t01AppointmentConfirmation(data: WaAppointmentConfirmData, phone: string): string {
    const message = `Bonjour ${data.clientName},\n\nVotre rendez-vous au Garage Sagman est confirmé.\n\n📅 Date : ${data.date}\n⏰ Heure : ${data.time}\n🚗 Véhicule : ${data.vehicleMakeModel} — ${data.matricule}\n🔧 Motif : ${data.purpose}\n\nMerci de vous présenter à l'heure.\nPour toute question : ${data.garagePhone}\n\nGarage Sagman`;
    return this.buildUrl(phone, message);
  }

  static t02AppointmentRescheduled(
    clientName: string, newDate: string, newTime: string,
    vehicleMakeModel: string, matricule: string, garagePhone: string, phone: string,
  ): string {
    const message = `Bonjour ${clientName},\n\nVotre rendez-vous a été déplacé.\n\n📅 Nouvelle date : ${newDate}\n⏰ Nouvelle heure : ${newTime}\n🚗 Véhicule : ${vehicleMakeModel} — ${matricule}\n\nNous nous excusons pour la gêne occasionnée.\nContact : ${garagePhone}\n\nGarage Sagman`;
    return this.buildUrl(phone, message);
  }

  static t03DiagnosisResults(data: WaDiagnosisData, phone: string): string {
    const issuesList = data.issues.map((i) => `• ${i.description} — Gravité : ${i.severity}`).join('\n');
    const currency = data.currencyLabel ?? 'DH';
    const message = `Bonjour ${data.clientName},\n\nLe diagnostic de votre véhicule est terminé.\n\n🚗 Véhicule : ${data.vehicleMakeModel} — ${data.matricule}\n📆 Date du diagnostic : ${data.diagnosisDate}\n\nPROBLÈMES IDENTIFIÉS :\n${issuesList}\n\nTRAVAUX RECOMMANDÉS :\n• ${data.recommendedRepairs}\n\n💰 Estimation : ${data.estimatedCost} ${currency}\n⏱ Durée estimée : ${data.estimatedDays} jours\n\nMerci de nous confirmer votre accord pour procéder.\nContact : ${data.garagePhone}\n\nGarage Sagman`;
    return this.buildUrl(phone, message);
  }

  static t04CarReady(data: WaReadyData, phone: string): string {
    const currency = data.currencyLabel ?? 'DH';
    const message = `Bonjour ${data.clientName},\n\nVotre véhicule est prêt à être récupéré.\n\n🚗 Véhicule : ${data.vehicleMakeModel} — ${data.matricule}\n🔧 Travaux effectués : ${data.repairSummary}\n💰 Montant à régler : ${data.totalAmount} ${currency}\n\nVous pouvez passer le récupérer pendant nos heures d'ouverture.\nContact : ${data.garagePhone}\n\nGarage Sagman`;
    return this.buildUrl(phone, message);
  }

  static t05Invoice(
    clientName: string, phone: string,
    invoiceData: {
      invoiceNumber: string; date: string; clientPhone: string;
      vehicleMakeModel: string; matricule: string;
      laborItems: Array<{ description: string; cost: number }>;
      parts: Array<{ name: string; qty: number; unitCost: number; total: number }>;
      partsTotal: number; laborTotal: number; discount: number;
      grandTotal: number; amountReceived: number; changeDue: number;
      mechanicNames: string; managerName: string;
      garageAddress: string; garagePhone: string; currencyLabel?: string;
    },
  ): string {
    const currency = invoiceData.currencyLabel ?? 'DH';
    const laborLines = invoiceData.laborItems.map((l) => `• ${l.description} .............. ${l.cost} ${currency}`).join('\n');
    const partLines = invoiceData.parts.map((p) => `• ${p.name} × ${p.qty} ................. ${p.total} ${currency}`).join('\n');
    const message = `Bonjour ${clientName},\n\nVoici votre reçu pour les travaux effectués.\n\n════════════════════════\n    FACTURE SAGMAN\n════════════════════════\nN° : ${invoiceData.invoiceNumber}          Date : ${invoiceData.date}\n\nClient : ${clientName}\nTél.   : ${invoiceData.clientPhone}\nVéhicule : ${invoiceData.vehicleMakeModel}\nMatricule : ${invoiceData.matricule}\n\nMAIN D'ŒUVRE :\n${laborLines}\n\nPIÈCES :\n${partLines}\n\n────────────────────────\nPARTS TOTAL     ${invoiceData.partsTotal} ${currency}\nLABOR TOTAL     ${invoiceData.laborTotal} ${currency}\nDISCOUNT        ${invoiceData.discount} ${currency}\nGRAND TOTAL     ${invoiceData.grandTotal} ${currency}\nReçu            ${invoiceData.amountReceived} ${currency}\nRendu           ${invoiceData.changeDue} ${currency}\n────────────────────────\n\nMécanicien : ${invoiceData.mechanicNames}\nResponsable : ${invoiceData.managerName}\n\nMerci de votre confiance.\nGarage Sagman — ${invoiceData.garageAddress} — ${invoiceData.garagePhone}\n════════════════════════`;
    return this.buildUrl(phone, message);
  }
}
