import React from 'react';
import { Layout } from '../components/Layout';
import { Search, Book, MessageCircle, Phone, FileText, ChevronRight, PlayCircle } from 'lucide-react';

export function Help() {
  return (
    <Layout title="Help Center">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-black text-on-surface tracking-tight">How can we help you today?</h2>
          <p className="text-lg text-slate-500 font-medium">Search our documentation or contact our support engineers.</p>
          <div className="max-w-2xl mx-auto relative mt-8">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
            <input 
              className="w-full pl-14 pr-6 py-5 bg-white shadow-xl shadow-slate-200/50 border-none rounded-2xl text-lg placeholder:text-slate-400 focus:ring-2 focus:ring-primary transition-all"
              placeholder="Search for articles, guides, API docs..."
              type="text"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Book, title: 'Getting Started', desc: 'Learn the basics of Kolet Pay and set up your first invoice.' },
            { icon: FileText, title: 'API Reference', desc: 'Integrate our fintech engine directly into your enterprise ERP.' },
            { icon: PlayCircle, title: 'Video Tutorials', desc: 'Watch step-by-step guides on inventory and bot management.' },
          ].map((card, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:border-primary/20 transition-all cursor-pointer group">
              <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/5 transition-colors">
                <card.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-2">{card.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">{card.desc}</p>
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <span>Read More</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 rounded-3xl p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4">
            <h3 className="text-3xl font-bold">Still need assistance?</h3>
            <p className="text-slate-400 max-w-md">Our dedicated support team is available 24/7 for enterprise partners.</p>
          </div>
          <div className="flex gap-4">
            <button className="flex items-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-slate-100 transition-all">
              <MessageCircle className="w-6 h-6" />
              Live Chat
            </button>
            <button className="flex items-center gap-3 px-8 py-4 bg-white/10 text-white border border-white/20 rounded-2xl font-bold hover:bg-white/20 transition-all">
              <Phone className="w-6 h-6" />
              Call Support
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
