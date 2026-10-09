import Link from 'next/link';
import {getPlatformBrand} from '@/lib/server/branding';
import {ArrowRight, BarChart3, CreditCard, Users} from 'lucide-react';

export default async function Home(){
  const brand=await getPlatformBrand();
  return <main>
    <section className="hero">
      <div className="hero-inner">
        <div className="tag">{brand.name.toUpperCase()} · BUSINESS OPERATING PLATFORM</div>
        <h1>Run the business. Understand the numbers. Move forward.</h1>
        <p>One polished workspace for customers, sales, orders, payments, expenses, inventory and business performance.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/signup">Create your workspace <ArrowRight size={15}/></Link>
          <Link className="btn" href="/dashboard">Explore the dashboard</Link>
        </div>
      </div>
    </section>
    <section className="home-features">
      <div className="feature-grid">
        <div className="feature"><BarChart3 size={20}/><h3>See the business clearly</h3><p>Sales, money received, expenses and estimated profit stay connected instead of living in separate tools.</p></div>
        <div className="feature"><CreditCard size={20}/><h3>Stay on top of payments</h3><p>Record deposits, part-payments and balances while keeping every customer transaction easy to follow.</p></div>
        <div className="feature"><Users size={20}/><h3>Build better relationships</h3><p>Keep customer history, orders, balances and follow-up actions together in one professional workspace.</p></div>
      </div>
    </section>
  </main>
}
