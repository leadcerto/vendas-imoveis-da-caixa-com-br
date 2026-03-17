"use client";

import { IoLogoWhatsapp } from 'react-icons/io5';

export default function WhatsAppFloating() {
  const whatsappNumber = "5521997882950";
  const message = encodeURIComponent("Olá! Gostaria de falar com um consultor sobre os imóveis da Caixa.");

  return (
    <a 
      href={`https://wa.me/${whatsappNumber}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-[9999] w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-green-400 transition-all active:scale-95 group animate-pulse"
      title="Falar no WhatsApp"
    >
      <IoLogoWhatsapp size={40} />
      <span className="absolute right-full mr-4 bg-white text-gray-900 px-4 py-2 rounded-xl text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none">
        Dúvidas? Fale conosco!
      </span>
    </a>
  );
}
