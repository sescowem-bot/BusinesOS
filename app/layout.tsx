import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'BusinessOS — Run your business, made simple',description:'A modern operating platform for small and growing businesses.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
