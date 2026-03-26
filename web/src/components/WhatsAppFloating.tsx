"use client";

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useWhatsApp } from '../context/WhatsAppContext';
import { formatWhatsAppLink } from '@/lib/whatsapp';

export default function WhatsAppFloating() {
  const pathname = usePathname();
  const { whatsAppData } = useWhatsApp();
  if (pathname === '/busca-imoveis') return null;
  
  const imobiliaria = whatsAppData.imobiliaria;
  const phone = imobiliaria?.imobiliaria_whatsapp_numero || "5521978822950";
  const buttonImage = imobiliaria?.imobiliaria_whatsapp_botao || "/FaleComigo.png";
  
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    }
  }, [pathname]);

  const getWhatsAppLink = () => {
    let message = "";
    if (whatsAppData.propertyNumber && whatsAppData.bairro && whatsAppData.cidade) {
      // Message for property pages
      message = `. 📌 Olá! Tenho interesse no Imóvel da Caixa número *${whatsAppData.propertyNumber}* localizado em *${whatsAppData.bairro}* - *${whatsAppData.cidade}*`;
    } else {
      // Message for general pages
      message = `. 📌 Olá! Visitei o site de vocês e preciso de ajuda\n.\n[${currentUrl}]`;
    }
    
    return formatWhatsAppLink(phone, message);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none flex justify-center pb-6">
      <div className="pointer-events-auto">
        <a 
          href={getWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="block transition-transform duration-300 hover:scale-105 active:scale-95 group"
          title="Falar no WhatsApp"
        >
          <div className="relative">
            {/* Soft Glow beneath the button */}
            <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <img 
              src={buttonImage} 
              alt="Atendimento WhatsApp" 
              className="h-[60px] md:h-[80px] w-auto shadow-[0_10px_30px_rgba(0,0,0,0.3)] rounded-lg"
            />
          </div>
        </a>
      </div>
    </div>
  );
}
