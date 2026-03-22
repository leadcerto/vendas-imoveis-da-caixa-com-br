import type { Metadata } from "next";
import { Montserrat, Roboto } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Imóveis da Caixa | Portal de Busca Inteligente",
  description: "Encontre as melhores oportunidades de leilão e venda direta da Caixa com descontos exclusivos e análise de lucro.",
};

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { WhatsAppProvider } from "@/context/WhatsAppContext";
import WhatsAppFloating from "@/components/WhatsAppFloating";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${montserrat.variable} ${roboto.variable} antialiased font-sans flex flex-col min-h-screen`}
      >
        <WhatsAppProvider>
          <Header />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
          <WhatsAppFloating />
        </WhatsAppProvider>
      </body>
    </html>
  );
}
