/**
 * Formata um link de WhatsApp (wa.me) com número e mensagem opcional.
 * Garante que o número tenha o prefixo 55 se for brasileiro.
 */
export function formatWhatsAppLink(phone: string, message?: string): string {
  // Remove todos os caracteres não numéricos
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Se o número tiver 10 ou 11 dígitos (formato brasileiro sem DDI), adiciona 55
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    cleanPhone = '55' + cleanPhone;
  }
  
  const baseUrl = `https://wa.me/${cleanPhone}`;
  
  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }
  
  return baseUrl;
}
