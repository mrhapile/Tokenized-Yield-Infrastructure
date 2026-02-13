import Features from '@/components/home/Features';
import Footer from '@/components/home/Footer';
import Hero from '@/components/home/Hero';
import HowItWorks from '@/components/home/HowItWorks';
import Navigation from '@/components/Navigation';


export default function Home() {
  return <div className='min-h-screen'>
    <Navigation />
    <Hero />
    <HowItWorks />
    <Features />
    <Footer />

  </div>
}
