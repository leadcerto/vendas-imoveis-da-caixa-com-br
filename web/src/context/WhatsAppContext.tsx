"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

interface WhatsAppData {
  propertyNumber?: string;
  bairro?: string;
  cidade?: string;
}

interface WhatsAppContextType {
  whatsAppData: WhatsAppData;
  setWhatsAppData: (data: WhatsAppData) => void;
  resetWhatsAppData: () => void;
}

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined);

export function WhatsAppProvider({ children }: { children: ReactNode }) {
  const [whatsAppData, setWhatsAppDataInternal] = useState<WhatsAppData>({});

  const setWhatsAppData = useCallback((data: WhatsAppData) => {
    setWhatsAppDataInternal(data);
  }, []);

  const resetWhatsAppData = useCallback(() => {
    setWhatsAppDataInternal({});
  }, []);

  const value = useMemo(() => ({
    whatsAppData,
    setWhatsAppData,
    resetWhatsAppData
  }), [whatsAppData, setWhatsAppData, resetWhatsAppData]);

  return (
    <WhatsAppContext.Provider value={value}>
      {children}
    </WhatsAppContext.Provider>
  );
}

export function useWhatsApp() {
  const context = useContext(WhatsAppContext);
  if (context === undefined) {
    throw new Error('useWhatsApp must be used within a WhatsAppProvider');
  }
  return context;
}
