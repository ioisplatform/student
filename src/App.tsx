import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Navbar } from './components/Navbar';
import { TickerBar } from './components/TickerBar';
import { HomePageDashboard } from './components/HomePageDashboard';
import { PageHeader } from './components/PageHeader';
import { LiveClockPanchang } from './components/LiveClockPanchang';
import { QuickPageShortcuts } from './components/QuickPageShortcuts';
import { Footer } from './components/Footer';
import { AIChatBot } from './components/AIChatBot';
import { ThemeSelectorModal } from './components/ThemeSelector';
import { 
  ThemeMode, 
  ThemePreset, 
  getSavedThemeMode, 
  getSavedThemePreset, 
  applyThemeToDocument 
} from './services/themeService';

// Lazy Loaded Secondary Pages for Super Fast Initial Page Load (<100ms)
const RtpsJaminServicesPage = lazy(() => import('./components/RtpsJaminServicesPage').then(m => ({ default: m.RtpsJaminServicesPage })));
const WeatherPage = lazy(() => import('./components/WeatherPage').then(m => ({ default: m.WeatherPage })));
const LiveNewsPage = lazy(() => import('./components/LiveNewsPage').then(m => ({ default: m.LiveNewsPage })));
const EntertainmentChatPage = lazy(() => import('./components/EntertainmentChatPage').then(m => ({ default: m.EntertainmentChatPage })));
const PanchangRashifalPage = lazy(() => import('./components/PanchangRashifalPage').then(m => ({ default: m.PanchangRashifalPage })));
const MandiMarketPage = lazy(() => import('./components/MandiMarketPage').then(m => ({ default: m.MandiMarketPage })));
const GovtSchemesPage = lazy(() => import('./components/GovtSchemesPage').then(m => ({ default: m.GovtSchemesPage })));
const JobAlertsPage = lazy(() => import('./components/JobAlertsPage').then(m => ({ default: m.JobAlertsPage })));
const PlansGrid = lazy(() => import('./components/PlansGrid').then(m => ({ default: m.PlansGrid })));
const PayoutCalculator = lazy(() => import('./components/PayoutCalculator').then(m => ({ default: m.PayoutCalculator })));
const ParentsPortal = lazy(() => import('./components/ParentsPortal').then(m => ({ default: m.ParentsPortal })));
const StudentStudyPage = lazy(() => import('./components/StudentStudyPage').then(m => ({ default: m.StudentStudyPage })));
const IDCardGenerator = lazy(() => import('./components/IDCardGenerator').then(m => ({ default: m.IDCardGenerator })));
const RegistrationPortal = lazy(() => import('./components/RegistrationPortal').then(m => ({ default: m.RegistrationPortal })));
const UserDashboard = lazy(() => import('./components/UserDashboard').then(m => ({ default: m.UserDashboard })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const AssessmentPortal = lazy(() => import('./components/AssessmentPortal').then(m => ({ default: m.AssessmentPortal })));
const LegalPolicyPages = lazy(() => import('./components/LegalPolicyPages').then(m => ({ default: m.LegalPolicyPages })));
const ContactFaq = lazy(() => import('./components/ContactFaq').then(m => ({ default: m.ContactFaq })));

import { AuthModal } from './components/AuthModal';
import { RegistrationModal } from './components/RegistrationModal';
import { DashboardModal } from './components/DashboardModal';
import { IdCardModal } from './components/IdCardModal';
import { IoisServicesDrawerModal } from './components/IoisServicesDrawerModal';
import { Plan, UserProfile, PageType } from './types';
import { getCurrentUser, logoutUser, fetchUsersFromServer, setCurrentUser as persistCurrentUser } from './services/userService';
import { Sparkles, ArrowLeft, Home, Crown, FileText, GraduationCap, CreditCard, LayoutDashboard, UserPlus } from 'lucide-react';

const PageFallbackLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[350px] p-6 text-center space-y-4 animate-fadeIn">
    <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
    <div className="text-amber-400 font-bold text-xs sm:text-sm tracking-wide">पेज लोड हो रहा है, कृपया प्रतीक्षा करें...</div>
  </div>
);

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [selectedPlanForRegister, setSelectedPlanForRegister] = useState<number>(1);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatInitialQuery, setChatInitialQuery] = useState<string>('');

  // Theme Customization & Light/Dark Mode State
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getSavedThemeMode());
  const [themePreset, setThemePreset] = useState<ThemePreset>(() => getSavedThemePreset());
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);

  useEffect(() => {
    applyThemeToDocument(themeMode, themePreset);
  }, [themeMode, themePreset]);

  const handleToggleMode = () => {
    setThemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyThemeToDocument(next, themePreset);
      return next;
    });
  };

  const handlePresetChange = (preset: ThemePreset) => {
    setThemePreset(preset);
    applyThemeToDocument(themeMode, preset);
  };

  // User Authentication & Session State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'forgot_user_id' | 'forgot_password'>('login');
  const [authModalPrefill, setAuthModalPrefill] = useState<{ identifier?: string; mobile?: string; userId?: string }>({});

  // Dedicated Dialog Box Popups (Registration, Dashboard, ID Card, Services)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isDashboardModalOpen, setIsDashboardModalOpen] = useState<boolean>(false);
  const [isIdCardModalOpen, setIsIdCardModalOpen] = useState<boolean>(false);
  const [isServicesModalOpen, setIsServicesModalOpen] = useState<boolean>(false);

  // Fast Non-Blocking Deferred Sync with backend (Prioritizes 0-delay instant initial page paint)
  useEffect(() => {
    let isMounted = true;
    const sync = async () => {
      try {
        const freshUsers = await fetchUsersFromServer();
        if (isMounted && currentUser) {
          const found = freshUsers.find((u) => u.userId.toUpperCase() === currentUser.userId.toUpperCase());
          if (found) {
            setCurrentUser(found);
            persistCurrentUser(found);
          }
        }
      } catch (e) {
        // Non-blocking fallback
      }
    };
    
    // First sync after 1.2s so initial load happens instantly without any network wait
    const initialTimer = setTimeout(sync, 1200);
    const interval = setInterval(sync, 25000);
    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [currentUser?.userId]);

  const navigateTo = (page: PageType) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenChatWithQuery = (query: string) => {
    setChatInitialQuery(query);
    setIsChatOpen(true);
  };

  const handleOpenLogin = (
    mode: 'login' | 'forgot_user_id' | 'forgot_password' = 'login',
    prefill?: { identifier?: string; mobile?: string; userId?: string }
  ) => {
    setAuthModalInitialMode(mode);
    setAuthModalPrefill(prefill || {});
    setIsAuthModalOpen(true);
  };

  const handleOpenRegister = (planId?: number) => {
    if (planId) setSelectedPlanForRegister(planId);
    setIsRegisterModalOpen(true);
  };

  const handleOpenDashboard = () => {
    if (!currentUser) {
      handleOpenLogin('login');
      return;
    }
    setIsDashboardModalOpen(true);
  };

  const handleOpenIdCard = () => {
    setIsIdCardModalOpen(true);
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setIsDashboardModalOpen(false);
    navigateTo('home');
  };

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    // Open the member dashboard dialog box window directly!
    setIsDashboardModalOpen(true);
  };

  const handleRegisterSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setIsRegisterModalOpen(false);
    // Open the member dashboard dialog box window directly!
    setIsDashboardModalOpen(true);
  };

  const handleSelectPlanForRegister = (planId: number) => {
    setSelectedPlanForRegister(planId);
    setIsRegisterModalOpen(true);
  };

  return (
    <div 
      className="min-h-screen flex flex-col transition-colors duration-300 selection:bg-amber-500 selection:text-black"
      style={{
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-primary)',
      }}
    >
      {/* 1. Header & Navigation (Always connects to home and all pages) */}
      <Navbar
        currentUser={currentUser}
        currentPage={currentPage}
        onNavigate={navigateTo}
        onOpenChat={() => {
          setChatInitialQuery('');
          setIsChatOpen(true);
        }}
        onOpenServices={() => setIsServicesModalOpen(true)}
        onOpenLogin={() => handleOpenLogin('login')}
        onOpenRegister={() => handleOpenRegister()}
        onOpenDashboard={handleOpenDashboard}
        onOpenIdCard={handleOpenIdCard}
        onLogout={handleLogout}
        currentMode={themeMode}
        onToggleMode={handleToggleMode}
        onOpenThemeModal={() => setIsThemeModalOpen(true)}
      />

      {/* 2. Controlled Live News & Instant Payout Ticker */}
      <TickerBar onOpenRegister={(planId) => handleSelectPlanForRegister(planId || 1)} />

      {/* 3. Main Dynamic Content Area based on Current Page - Full width & responsive */}
      <main className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-10 space-y-6 sm:space-y-12 flex-1 pb-36 sm:pb-16">
        <Suspense fallback={<PageFallbackLoader />}>
        
        {/* ================= PAGE 1: HOME PAGE (Central Dashboard with all section buttons) ================= */}
        {currentPage === 'home' && (
          <div className="space-y-12">
            {/* If logged in, show quick dashboard notice */}
            {currentUser && (
              <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border border-amber-400 shrink-0">
                    <img src={currentUser.photoUrl} alt={currentUser.fullName} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <span className="text-xs text-amber-400 font-bold block">सक्रिय लॉगिन सत्र (Active Member):</span>
                    <h3 className="text-base sm:text-lg font-black text-white">{currentUser.fullName} ({currentUser.userId})</h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenDashboard}
                    className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 transition cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>डैशबोर्ड डायलॉग खोलें →</span>
                  </button>
                  <button
                    onClick={handleOpenIdCard}
                    className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                    <span>ID कार्ड</span>
                  </button>
                </div>
              </div>
            )}

            {/* Central Navigation Hub with Live Dual Clocks, Guided Purpose Welcome & Complete IOIS Overview */}
            <HomePageDashboard
              onNavigate={navigateTo}
              onOpenLogin={() => handleOpenLogin('login')}
              onOpenRegister={handleOpenRegister}
              onOpenDashboard={handleOpenDashboard}
              onOpenIdCard={handleOpenIdCard}
              onOpenAiChat={() => {
                setChatInitialQuery('');
                setIsChatOpen(true);
              }}
              onSelectPlanForRegister={handleSelectPlanForRegister}
            />
          </div>
        )}

        {/* ================= PAGE 2: 7 MASTER PLANS PAGE ================= */}
        {currentPage === 'plans' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="plans"
              onNavigate={navigateTo}
              title="7 मास्टर प्लांस (IOIS 7 Master Plans)"
              subtitle="₹10 से ₹999 तक के सभी आधिकारिक प्लांस, 50% से 70% इंसेंटिव व डिजिटल संसाधन"
            />
            <PlansGrid
              onAskAI={handleOpenChatWithQuery}
              onSelectPlanForRegister={handleSelectPlanForRegister}
            />
          </div>
        )}

        {/* ================= PAGE 3: REGISTRATION PAGE ================= */}
        {currentPage === 'register' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-black tracking-wider text-amber-400">सुविधाजनक विकल्प</span>
                <h4 className="text-sm font-black text-white">पॉप-अप डायलॉग बॉक्स (Modal) विंडो में भरें</h4>
                <p className="text-xs text-slate-300">यदि आप पेज बदले बिना त्वरित 3-स्टेप फॉर्म भरना चाहते हैं, तो पॉप-अप विंडो खोलें।</p>
              </div>
              <button
                onClick={() => handleOpenRegister(selectedPlanForRegister)}
                className="shrink-0 px-4 py-2.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 hover:scale-105 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>पॉप-अप विंडो खोलें</span>
              </button>
            </div>
            <PageHeader
              currentPage="register"
              onNavigate={navigateTo}
              title="नया सदस्य रजिस्ट्रेशन (Member Registration)"
              subtitle="3 आसान चरणों में पंजीकरण पूर्ण करें और तुरंत डिजिटल ID कार्ड प्राप्त करें"
            />
            <RegistrationPortal
              onRegisterSuccess={handleRegisterSuccess}
              onOpenLogin={handleOpenLogin}
              preSelectedPlanId={selectedPlanForRegister}
            />
          </div>
        )}

        {/* ================= PAGE 4: DIGITAL ID CARD PAGE ================= */}
        {currentPage === 'idcard' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-black tracking-wider text-blue-400">त्वरित प्रिव्यू</span>
                <h4 className="text-sm font-black text-white">ID कार्ड पॉप-अप डायलॉग विंडो</h4>
                <p className="text-xs text-slate-300">किसी भी पेज से सीधा डायलॉग बॉक्स में ID कार्ड देखें व PNG डाउनलोड करें।</p>
              </div>
              <button
                onClick={handleOpenIdCard}
                className="shrink-0 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 hover:scale-105 transition cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>पॉप-अप में देखें</span>
              </button>
            </div>
            <PageHeader
              currentPage="idcard"
              onNavigate={navigateTo}
              title="वेरिफाइड डिजिटल ID कार्ड जनरेटर (Digital ID Card)"
              subtitle="256-Bit एन्क्रिप्टेड स्मार्ट डिजिटल पहचान पत्र, आगे-पीछे का प्रिव्यू व HD PNG डाउनलोड"
            />
            <IDCardGenerator
              currentUser={currentUser}
              onOpenRegister={() => handleOpenRegister()}
            />
          </div>
        )}

        {/* ================= PAGE 5: PAYOUT CALCULATOR PAGE ================= */}
        {currentPage === 'calculator' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="calculator"
              onNavigate={navigateTo}
              title="इंसेंटिव व अर्निंग कैलकुलेटर (Payout Calculator)"
              subtitle="योजना अनुसार 50% से 70% दैनिक, साप्ताहिक व मासिक रेफरल आय का लाइव सिमुलेटर"
            />
            <PayoutCalculator />
          </div>
        )}

        {/* ================= PAGE 6: ASSESSMENT & INTERVIEW TEST PAGE ================= */}
        {currentPage === 'assessment' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="assessment"
              onNavigate={navigateTo}
              title="कैरियर व प्लान असेसमेंट टेस्ट (Interview & Assessment)"
              subtitle="2 मिनट का इंटरएक्टिव टेस्ट जो आपकी रुचि व लक्ष्य के अनुसार सही प्लान सुझाए"
            />
            <AssessmentPortal onAskAI={handleOpenChatWithQuery} />
          </div>
        )}

        {/* ================= PAGE 7: PARENTS PORTAL PAGE ================= */}
        {currentPage === 'parents' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="parents"
              onNavigate={navigateTo}
              title="अभिभावक सुरक्षा व सत्यापन (Parents Portal)"
              subtitle="100% सुरक्षित डिजिटल वातावरण, NCERT पाठ्यक्रम व बाल सुरक्षा नीतियां"
            />
            <ParentsPortal />
          </div>
        )}

        {/* ================= PAGE 7.2: STUDENT STUDY & CAREER PORTAL ================= */}
        {(currentPage === 'study' || currentPage === 'student-study') && (
          <div className="space-y-8">
            <PageHeader
              currentPage={currentPage}
              onNavigate={navigateTo}
              title="विद्यार्थी शिक्षा व करियर हब (Student Study & Career Portal)"
              subtitle="Class 1-12 & BA/BSc/BCom NCERT नोट्स, ADCA कंप्यूटर कोर्स, बोनाफाइड सर्टिफिकेट व संपूर्ण करियर गाइड"
            />
            <StudentStudyPage
              onNavigate={navigateTo}
              onOpenAiChatWithQuery={handleOpenChatWithQuery}
            />
          </div>
        )}

        {/* ================= PAGE 7.5: RTPS & JAMIN SUDHAR & SCHEMES PAGE ================= */}
        {currentPage === 'rtps-services' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="rtps-services"
              onNavigate={navigateTo}
              title="RTPS, जमीन सुधार, आधार-पैन व मुफ्त सरकारी योजनाएं (Citizen Services Guide)"
              subtitle="जाति, आय, निवास, दाखिल खारिज, परिमार्जन, LPC, instant e-PAN, पेंशन व छात्रवृत्ति के आवश्यक दस्तावेज, आवेदन विधि व सत्यापन प्रक्रिया"
            />
            <RtpsJaminServicesPage />
          </div>
        )}

        {/* ================= PAGE 8: LIVE WEATHER PAGE ================= */}
        {currentPage === 'weather' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="weather"
              onNavigate={navigateTo}
              title="लाइव मौसम, वर्षा अलर्ट व 7-दिवसीय पूर्वानुमान (Live Weather)"
              subtitle="सटीक शहरवार तापमान, बादलों की स्थिति, बारिश एनिमेशन व आधिकारिक मौसम अलर्ट"
            />
            <WeatherPage />
          </div>
        )}

        {/* ================= PAGE 9: LIVE NEWS & E-PAPER PAGE ================= */}
        {currentPage === 'news' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="news"
              onNavigate={navigateTo}
              title="लाइव 24x7 टीवी चैनल्स व ई-अखबार डायरेक्टरी (Live News & E-Papers)"
              subtitle="देश-दुनिया की ताजा खबरें, 6 प्रमुख टीवी लाइव स्ट्रीम व डिजिटल समाचार पत्र"
            />
            <LiveNewsPage />
          </div>
        )}

        {/* ================= PAGE 9.5: ENTERTAINMENT, CHAT & AI TOOLS HUB ================= */}
        {(currentPage === 'entertainment' || currentPage === 'entertainment-chat') && (
          <div className="space-y-8">
            <PageHeader
              currentPage={currentPage}
              onNavigate={navigateTo}
              title="मनोरंजन, कम्युनिटी लाइव चैट व फ्री AI टूल्स हब (Entertainment & Chat Hub)"
              subtitle="बिना Ads के वीडियो व प्लेलिस्ट प्लेयर, सदस्यों के साथ फोटो/वॉइस/वीडियो चैट और गूगल सर्च व ChatGPT एआई टूल्स"
            />
            <EntertainmentChatPage
              currentUser={currentUser}
              onOpenLogin={() => handleOpenLogin('login')}
              onNavigateToPlans={() => navigateTo('plans')}
            />
          </div>
        )}

        {/* ================= PAGE 10: PANCHANG & RASHIFAL PAGE ================= */}
        {currentPage === 'panchang-rashifal' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="panchang-rashifal"
              onNavigate={navigateTo}
              title="लाइव घड़ी, दैनिक पंचांग व 12 राशि भविष्य (Panchang & Daily Horoscope)"
              subtitle="सटीक भारतीय वैदिक पंचांग, शुभ मुहूर्त, राहु काल व 12 राशियों का लकी कलर व नंबर"
            />
            <PanchangRashifalPage />
          </div>
        )}

        {/* ================= PAGE 11: MANDI & BULLION MARKET PAGE ================= */}
        {currentPage === 'mandi-market' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="mandi-market"
              onNavigate={navigateTo}
              title="लाइव कृषि मंडी भाव, सोना-चांदी व स्मार्ट डील्स (Mandi & Bullion)"
              subtitle="फसलों के दैनिक मंडी भाव, 10 प्रमुख शहरों के 24K/22K गोल्ड रेट व आज क्या सस्ता क्या महंगा"
            />
            <MandiMarketPage />
          </div>
        )}

        {/* ================= PAGE 12: GOVT SCHEMES & WEBSITES PAGE ================= */}
        {currentPage === 'govt-schemes' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="govt-schemes"
              onNavigate={navigateTo}
              title="सरकारी योजनाएं, आवश्यक वेबसाइट्स व नागरिक कानून (Govt Directory)"
              subtitle="आधार, पैन, राशन, भूलेख, PF, आयुष्मान की पूरी जानकारी व इस्तेमाल का आसान तरीका"
            />
            <GovtSchemesPage />
          </div>
        )}

        {/* ================= PAGE 13: LIVE JOBS & CAREERS PAGE ================= */}
        {currentPage === 'jobs' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="jobs"
              onNavigate={navigateTo}
              title="लाइव सरकारी व प्राइवेट नौकरी अलर्ट (Jobs & Careers)"
              subtitle="SSC, रेलवे, बैंक, पुलिस की नई भर्तियां और IOIS में वर्क-फ्रॉम-होम डिजिटल इनकम के अवसर"
            />
            <JobAlertsPage onOpenRegister={() => handleOpenRegister()} />
          </div>
        )}

        {/* ================= PAGE 14: LIVE UTILITIES PAGE ================= */}
        {currentPage === 'utilities' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="utilities"
              onNavigate={navigateTo}
              title="लाइव घड़ी, पंचांग व स्मार्ट टीवी डिस्प्ले (Utilities)"
              subtitle="सटीक भारतीय पंचांग, डिजिटल एनालॉग क्लॉक व टीवी डिस्प्ले मोड"
            />
            <LiveClockPanchang />
          </div>
        )}

        {/* ================= PAGE 9: ADMIN APPROVAL PANEL PAGE ================= */}
        {currentPage === 'admin' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="admin"
              onNavigate={navigateTo}
              title="आधिकारिक एडमिन पैनल (Admin Approval & Verification)"
              subtitle="सदस्य वेरिफिकेशन, पेमेंट प्रूफ अप्रूवल/रिजेक्शन व हेल्पडेस्क सपोर्ट"
            />
            <AdminPanel
              onUserStatusChange={() => {
                const current = getCurrentUser();
                if (current) setCurrentUser(current);
              }}
            />
          </div>
        )}

        {/* ================= PAGE 10: USER DASHBOARD PAGE ================= */}
        {currentPage === 'dashboard' && (
          <div className="space-y-8">
            {currentUser && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-amber-400">सुपर फास्ट एक्सेस</span>
                  <h4 className="text-sm font-black text-white">पॉप-अप डैशबोर्ड डायलॉग विंडो</h4>
                  <p className="text-xs text-slate-300">बिना फुल-पेज स्क्रॉल किए डायलॉग बॉक्स में प्रोफाइल, ID कार्ड व सपोर्ट टिकट मैनेज करें।</p>
                </div>
                <button
                  onClick={handleOpenDashboard}
                  className="shrink-0 px-4 py-2.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 hover:scale-105 transition cursor-pointer"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>डायलॉग बॉक्स में खोलें</span>
                </button>
              </div>
            )}
            <PageHeader
              currentPage="dashboard"
              onNavigate={navigateTo}
              title="सदस्य प्रोफाइल व डैशबोर्ड (Member Dashboard)"
              subtitle="अपनी प्रोफाइल एडिट करें, वेरिफिकेशन स्टेटस देखें व सपोर्ट टिकट बनाएं"
            />
            {currentUser ? (
              <UserDashboard
                user={currentUser}
                onUserUpdated={(updated) => setCurrentUser(updated)}
                onLogout={handleLogout}
                onScrollToCard={() => handleOpenIdCard()}
              />
            ) : (
              <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-4">
                <p className="text-slate-300">डैशबोर्ड देखने के लिए कृपया लॉगिन करें या नया खाता रजिस्टर करें।</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleOpenLogin('login')}
                    className="px-6 py-2.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 transition cursor-pointer"
                  >
                    लॉगिन करें
                  </button>
                  <button
                    onClick={() => handleOpenRegister()}
                    className="px-6 py-2.5 rounded-full bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition cursor-pointer"
                  >
                    नया रजिस्ट्रेशन
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= PAGE 11: CONTACT & FAQ PAGE ================= */}
        {currentPage === 'contact' && (
          <div className="space-y-8">
            <PageHeader
              currentPage="contact"
              onNavigate={navigateTo}
              title="आधिकारिक संपर्क व अक्सर पूछे जाने वाले प्रश्न (Help & FAQs)"
              subtitle="24x7 WhatsApp, Telegram सपोर्ट व आपके सभी संशयों का त्वरित समाधान"
            />
            <ContactFaq onAskAI={handleOpenChatWithQuery} />
          </div>
        )}

        {/* ================= PAGE 12: GOOGLE ADSENSE LEGAL POLICIES ================= */}
        {(currentPage === 'privacy-policy' || currentPage === 'terms' || currentPage === 'disclaimer') && (
          <LegalPolicyPages
            initialTab={currentPage}
            onNavigate={navigateTo}
          />
        )}

        {/* ================= STANDARD BOTTOM SHORTCUTS BAR FOR ALL SUB-PAGES ================= */}
        {currentPage !== 'home' && (
          <QuickPageShortcuts
            currentPage={currentPage}
            onNavigate={navigateTo}
            onOpenAiChat={() => {
              setChatInitialQuery('');
              setIsChatOpen(true);
            }}
            onOpenServicesModal={() => setIsServicesModalOpen(true)}
            onOpenRegister={handleOpenRegister}
            onOpenIdCard={handleOpenIdCard}
          />
        )}
        </Suspense>
      </main>

      {/* 4. Official Footer with AdSense Compliance Navigation */}
      <Footer onNavigate={navigateTo} />

      {/* 5. Mobile Bottom Quick Navigation Bar (1-Click access to top portals on phones) */}
      <nav 
        id="mobile-bottom-nav" 
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-amber-500/30 px-1 py-1.5 sm:hidden flex items-center justify-around shadow-[0_-5px_20px_rgba(0,0,0,0.8)]"
      >
        <button
          onClick={() => navigateTo('home')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
            currentPage === 'home' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className="w-4 h-4" />
          <span className="text-[10px] mt-0.5 font-bold">होम</span>
        </button>

        <button
          onClick={() => navigateTo('plans')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
            currentPage === 'plans' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] mt-0.5 font-bold">7 प्लान्स</span>
        </button>

        <button
          onClick={() => navigateTo('rtps-services')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
            currentPage === 'rtps-services' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] mt-0.5 font-bold">RTPS</span>
        </button>

        <button
          onClick={handleOpenIdCard}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-blue-400 hover:text-blue-300 transition"
        >
          <CreditCard className="w-4 h-4 text-blue-400" />
          <span className="text-[10px] mt-0.5 font-bold">ID कार्ड</span>
        </button>

        {currentUser ? (
          <button
            onClick={handleOpenDashboard}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-amber-400 font-black transition"
          >
            <LayoutDashboard className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] mt-0.5 font-bold">डैशबोर्ड</span>
          </button>
        ) : (
          <button
            onClick={() => handleOpenRegister()}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-emerald-400 font-black transition"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] mt-0.5 font-bold">रजिस्टर</span>
          </button>
        )}
      </nav>

      {/* 6. Floating AI Chatbot Launcher Button - Positioned safely above mobile dock with Live Prompt Pill */}
      <div className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setChatInitialQuery('आज कौन सा दिन व तारीख है?');
            setIsChatOpen(true);
          }}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-lg backdrop-blur-md transition transform hover:scale-105 cursor-pointer"
          style={{
            backgroundColor: themeMode === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            color: themeMode === 'light' ? '#0f172a' : '#f8fafc',
          }}
          title="आज का दिन तुरंत पूछें"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>📅 आज का दिन पूछें</span>
        </button>

        <button
          id="floating-ai-chat-launcher"
          onClick={() => {
            setChatInitialQuery('');
            setIsChatOpen(true);
          }}
          className="relative bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 px-3.5 sm:px-4 py-2.5 sm:py-3.5 rounded-full font-black text-xs sm:text-sm shadow-[0_10px_35px_rgba(212,175,55,0.45)] flex items-center gap-1.5 sm:gap-2 transition transform hover:scale-108 active:scale-95 cursor-pointer border-2 border-white/50 group"
          title="Open Live AI Assistant (चिंटू AI)"
        >
          <Sparkles className="w-4 h-4 text-black animate-spin" style={{ animationDuration: '4s' }} />
          <span>Ask IOIS AI</span>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
        </button>
      </div>

      {/* 7. Live AI Chatbot Modal / Drawer */}
      <AIChatBot
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        initialQuery={chatInitialQuery}
        onNavigate={navigateTo}
        onOpenLogin={handleOpenLogin}
        onSelectPlanForRegister={handleSelectPlanForRegister}
        currentUser={currentUser}
      />

      {/* 8. Auth Modal (Login / Forgot ID / Forgot Password) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccessLogin={handleLoginSuccess}
        onSwitchToRegister={() => {
          setIsAuthModalOpen(false);
          setIsRegisterModalOpen(true);
        }}
        initialMode={authModalInitialMode}
        initialIdentifier={authModalPrefill.identifier}
        initialMobile={authModalPrefill.mobile}
        initialUserId={authModalPrefill.userId}
      />

      {/* 9. Dedicated Registration Pop-Up Dialog Box Modal */}
      <RegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onRegisterSuccess={handleRegisterSuccess}
        onOpenLogin={(mode, prefill) => {
          setIsRegisterModalOpen(false);
          handleOpenLogin(mode || 'login', prefill);
        }}
        initialPlanId={selectedPlanForRegister}
      />

      {/* 10. Dedicated Member Dashboard Pop-Up Dialog Box Modal */}
      <DashboardModal
        isOpen={isDashboardModalOpen}
        onClose={() => setIsDashboardModalOpen(false)}
        user={currentUser}
        onUserUpdated={(updated) => setCurrentUser(updated)}
        onLogout={handleLogout}
        onOpenLogin={() => {
          setIsDashboardModalOpen(false);
          handleOpenLogin('login');
        }}
      />

      {/* 11. Dedicated Digital ID Card Pop-Up Dialog Box Modal */}
      <IdCardModal
        isOpen={isIdCardModalOpen}
        onClose={() => setIsIdCardModalOpen(false)}
        user={currentUser}
        onOpenRegister={() => {
          setIsIdCardModalOpen(false);
          handleOpenRegister();
        }}
        onOpenLogin={() => {
          setIsIdCardModalOpen(false);
          handleOpenLogin('login');
        }}
      />

      {/* 12. All IOIS Services & Portals Drawer Dialog Modal */}
      <IoisServicesDrawerModal
        isOpen={isServicesModalOpen}
        onClose={() => setIsServicesModalOpen(false)}
        currentPage={currentPage}
        onNavigate={navigateTo}
        onOpenAiChat={() => {
          setIsServicesModalOpen(false);
          setChatInitialQuery('');
          setIsChatOpen(true);
        }}
      />

      {/* 13. Dedicated Theme Customization & Light/Dark Mode Selector Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentMode={themeMode}
        currentPreset={themePreset}
        onModeChange={(mode) => {
          setThemeMode(mode);
          applyThemeToDocument(mode, themePreset);
        }}
        onPresetChange={handlePresetChange}
      />
    </div>
  );
}
