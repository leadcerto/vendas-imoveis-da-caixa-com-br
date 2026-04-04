"use client";

import { useEffect, useRef } from 'react';

type EventType = 'view' | 'whatsapp_click' | 'form_submit' | 'share_click';

export function useTracker(propertyNumber?: string | number) {
  const hasTrackedView = useRef(false);

  const trackEvent = async (tipo: EventType, metadata: any = {}) => {
    try {
      // Usar a nossa API interna de tracking
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imovel_id: propertyNumber,
          tipo_evento: tipo,
          sessao_id: getSessionId(),
          metadados: {
            ...metadata,
            url: window.location.href,
            referrer: document.referrer,
            timestamp: new Date().toISOString()
          }
        })
      });
    } catch (err) {
      // Falha silenciosa para não quebrar a navegação do usuário
      console.warn('Analytics track failed:', err);
    }
  };

  // Gerar um ID de sessão simples persistente na aba
  const getSessionId = () => {
    if (typeof window === 'undefined') return '';
    let sessionId = sessionStorage.getItem('caixa_analytics_session');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem('caixa_analytics_session', sessionId);
    }
    return sessionId;
  };

  // Track automático de visualização se o ID do imóvel for provido
  useEffect(() => {
    if (propertyNumber && !hasTrackedView.current) {
      trackEvent('view');
      hasTrackedView.current = true;
    }
  }, [propertyNumber]);

  return { trackEvent };
}
