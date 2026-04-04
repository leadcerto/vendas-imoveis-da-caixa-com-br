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

import Script from "next/script";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { WhatsAppProvider } from "@/context/WhatsAppContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Microsoft Clarity - Heatmaps & Session Recordings */}
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "pg6sk9x0x9");
          `}
        </Script>
      </head>
      <body
        className={`${montserrat.variable} ${roboto.variable} antialiased font-sans flex flex-col min-h-screen`}
      >
        <WhatsAppProvider>
          <Header />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </WhatsAppProvider>
      </body>
    </html>
  );
}
