import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, KnowledgeItem, ChatAction, PageType, UserProfile } from '../types';
import { 
  fetchKnowledgeFromFirestore,
  subscribeToFirestoreKnowledge,
  syncUnansweredToFirestore,
  INITIAL_KNOWLEDGE
} from '../services/userService';
import { 
  Sparkles, 
  Send, 
  X, 
  RotateCcw, 
  Bot, 
  User, 
  ShieldCheck, 
  ExternalLink,
  Minimize2,
  Maximize2,
  Globe,
  Compass,
  ArrowRight,
  LogIn,
  KeyRound,
  Search,
  BookOpen,
  FileCheck,
  CheckCircle2,
  PhoneCall,
  LayoutGrid,
  ChevronRight,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Copy,
  Check
} from 'lucide-react';

interface AIChatBotProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  onNavigate?: (page: PageType) => void;
  onOpenLogin?: (mode?: 'login' | 'forgot_password' | 'forgot_user_id') => void;
  onSelectPlanForRegister?: (planId: number) => void;
  currentUser?: UserProfile | null;
}

// System pages metadata for smart navigator
const ALL_SYSTEM_PAGES: { id: PageType; title: string; category: string; description: string; iconName: string }[] = [
  { id: 'register', title: 'नया रजिस्ट्रेशन (Registration)', category: 'सदस्य सेवाएं', description: '5 मिनट में सदस्य बनें व प्लान सक्रिय करें', iconName: 'UserPlus' },
  { id: 'plans', title: '7 मास्टर प्लांस (Plan 01 - 07)', category: 'आय व प्लान', description: '₹10 से ₹999 में लाइफटाइम एक्सेस व 70% पेआउट', iconName: 'Award' },
  { id: 'assessment', title: '15-सवाल कौशल साक्षात्कार', category: 'शिक्षा व करियर', description: 'कौशल असेसमेंट दें व सर्वोत्तम प्लान चुनें', iconName: 'Compass' },
  { id: 'idcard', title: 'स्मार्ट डिजिटल ID कार्ड', category: 'सदस्य सेवाएं', description: '256-बिट सुरक्षित ID कार्ड HD डाउनलोड करें', iconName: 'CreditCard' },
  { id: 'student-study', title: 'विद्यार्थी शिक्षा व नोट्स हब', category: 'शिक्षा व करियर', description: 'NCERT कक्षा 1-12, मैथ फॉर्मूला व स्कॉलरशिप', iconName: 'BookOpen' },
  { id: 'rtps-services', title: 'RTPS जाति/आय/निवास व जमीन', category: 'सरकारी सेवाएं', description: 'जाति, आय, निवास, दाखिल खारिज व e-PAN', iconName: 'FileCheck' },
  { id: 'govt-schemes', title: 'सरकारी योजनाएं पोर्टल', category: 'सरकारी सेवाएं', description: 'आयुष्मान ₹5 लाख, PM किसान, सूर्य घर', iconName: 'ShieldCheck' },
  { id: 'calculator', title: 'पेआउट व आय कैलकुलेटर', category: 'आय व प्लान', description: '50%-70% पेआउट की लाइव गणना करें', iconName: 'Calculator' },
  { id: 'weather', title: 'लाइव मौसम व वर्षा अलर्ट', category: 'जनोपयोगी सेवाएं', description: 'IMD उपग्रह मौसम पूर्वानुमान व वर्षा अलर्ट', iconName: 'CloudRain' },
  { id: 'news', title: '24x7 लाइव न्यूज़ टीवी', category: 'जनोपयोगी सेवाएं', description: 'प्रमुख राष्ट्रीय हिंदी समाचार चैनल लाइव', iconName: 'Tv' },
  { id: 'panchang-rashifal', title: 'वैदिक पंचांग व 12 राशिफल', category: 'जनोपयोगी सेवाएं', description: 'शुभ मुहूर्त, चौघड़िया व दैनिक राशिफल', iconName: 'Sun' },
  { id: 'mandi-market', title: 'मंडी भाव व सोना-चांदी दरें', category: 'जनोपयोगी सेवाएं', description: 'कृषि उपज मंडी व सराफा बाजार लाइव दरें', iconName: 'TrendingUp' },
  { id: 'jobs', title: 'सरकारी व प्राइवेट जॉब अलर्ट', category: 'शिक्षा व करियर', description: 'नवीनतम भर्ती अधिसूचनाएं व एडमिट कार्ड', iconName: 'Briefcase' },
  { id: 'dashboard', title: 'सदस्य प्रोफाइल डैशबोर्ड', category: 'सदस्य सेवाएं', description: 'अपनी प्रोफाइल, पेआउट व आईडी प्रबंधित करें', iconName: 'LayoutDashboard' },
  { id: 'parents', title: 'अभिभावक मार्गदर्शिका', category: 'शिक्षा व करियर', description: 'अभिभावकों के लिए उपयोगी मार्गदर्शन', iconName: 'Heart' },
  { id: 'entertainment', title: 'मनोरंजन व मीडिया हब', category: 'जनोपयोगी सेवाएं', description: 'प्रेरक कहानियां, ज्ञानवर्धक पॉडकास्ट', iconName: 'Music' }
];

// Client-side sanitizer to strip all markdown asterisks, hashes, and unwanted formatting noise
export function cleanBotText(raw: string): string {
  if (!raw) return '';
  let text = raw;
  // Remove markdown bold: **text** -> text
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  // Remove markdown italic: *text* -> text
  text = text.replace(/\*([^\*\n]+)\*/g, '$1');
  // Remove leftover consecutive asterisks
  text = text.replace(/\*{2,}/g, '');
  // Clean starting bullet asterisks to standard bullet
  text = text.replace(/^[\*]\s+/gm, '• ');
  // Remove any remaining stray asterisks
  text = text.replace(/\*/g, '');
  // Remove markdown headers (#, ##, ###)
  text = text.replace(/^#{1,6}\s*/gm, '');
  // Remove backticks
  text = text.replace(/`{1,3}/g, '');
  // Clean markdown links [text](url) -> text (url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  return text.trim();
}

// Client-Side Real-Time Indian Standard Time (IST) & Date Engine
export function getClientLiveIndianDate() {
  const now = new Date();
  const daysHi = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthsHi = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
  const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayIndex = now.getDay();
  const dayHi = daysHi[dayIndex];
  const dayEn = daysEn[dayIndex];
  const dateNum = now.getDate();
  const monthHi = monthsHi[now.getMonth()];
  const monthEn = monthsEn[now.getMonth()];
  const year = now.getFullYear();

  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  return {
    dayHi,
    dayEn,
    dateHi: `${dateNum} ${monthHi} ${year}`,
    dateEn: `${dateNum} ${monthEn} ${year}`,
    timeStr,
  };
}

export const AIChatBot: React.FC<AIChatBotProps> = ({ 
  isOpen, 
  onClose, 
  initialQuery,
  onNavigate,
  onOpenLogin,
  onSelectPlanForRegister,
  currentUser
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: `नमस्ते! 🙏 मैं IOIS AI हेल्पलाइन व संपूर्ण सिस्टम नेविगेटर हूँ (बाल विकास चिंटू AI शिक्षक मोड)।\n\nमैं आपको संपूर्ण IOIS प्लेटफॉर्म, बाल विकास (700+ डिजिटल पुस्तक), पढ़ाई, सामान्य ज्ञान और नागरिक सेवाओं के हर सवाल का सीधा और सटीक जवाब दूँगा।\n\nनीचे दिए गए बटनों पर क्लिक करें या अपना कोई भी सवाल पूछें!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: [
        { id: 'act-balvikas', label: '📖 बाल विकास (Plan 01 ₹10)', type: 'select_plan', planId: 1 },
        { id: 'act-reg', label: '📝 नया सदस्य रजिस्ट्रेशन', type: 'navigate', target: 'register' },
        { id: 'act-plans', label: '💎 7 मास्टर प्लांस (₹10 - ₹999)', type: 'navigate', target: 'plans' },
        { id: 'act-quiz', label: '🎯 15-सवाल कौशल साक्षात्कार', type: 'navigate', target: 'assessment' },
        { id: 'act-id', label: '🪪 डिजिटल ID कार्ड', type: 'navigate', target: 'idcard' },
        { id: 'act-study', label: '📚 NCERT नोट्स व मैथ फॉर्मूला', type: 'navigate', target: 'student-study' },
        { id: 'act-rtps', label: '🏛️ RTPS (जाति/आय/निवास)', type: 'navigate', target: 'rtps-services' },
        { id: 'act-login', label: '🔐 सदस्य लॉगिन', type: 'open_login', loginMode: 'login' }
      ]
    }
  ]);

  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showNavigator, setShowNavigator] = useState<boolean>(false);
  const [navSuccessMessage, setNavSuccessMessage] = useState<string | null>(null);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>(INITIAL_KNOWLEDGE);

  // Audio Speech and Voice Recognition State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const startVoiceInput = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('आपके ब्राउज़र में वॉइस पहचान उपलब्ध नहीं है। कृपया लिखकर सवाल पूछें।');
      return;
    }
    try {
      const recognition = new SpeechRec();
      recognition.lang = 'hi-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInput(transcript);
          handleSendMessage(transcript);
        }
      };
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSpeak = (text: string, msgId: string) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const clean = cleanBotText(text);
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'hi-IN';
    utter.rate = 1.0;
    utter.onend = () => setSpeakingMsgId(null);
    utter.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utter);
  };

  const handleCopyMessage = async (text: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(cleanBotText(text));
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {}
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, showNavigator]);

  // Load custom knowledge from Firestore (realtime subscription with graceful fallback)
  useEffect(() => {
    let isMounted = true;

    // Realtime subscription will push current documents immediately
    const unsub = subscribeToFirestoreKnowledge((items) => {
      if (isMounted && items && items.length > 0) {
        setKnowledgeList(items);
      }
    });

    // Fallback if offline or firestore takes a moment
    fetchKnowledgeFromFirestore()
      .then((items) => {
        if (isMounted && items && items.length > 0) {
          setKnowledgeList(items);
        }
      })
      .catch(() => {
        // Fallback already defaults to INITIAL_KNOWLEDGE
      });

    return () => {
      isMounted = false;
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, []);

  // Handle incoming query if provided externally
  useEffect(() => {
    if (initialQuery && initialQuery.trim() !== '') {
      handleSendMessage(initialQuery);
    }
  }, [initialQuery]);

  const findDirectKnowledgeMatch = (userText: string): string | null => {
    const cleanUserText = userText.trim().toLowerCase();
    if (!cleanUserText) return null;

    // Direct match against taught questions
    for (const item of knowledgeList) {
      const qLower = (item.question || '').toLowerCase();
      if (qLower === cleanUserText) return item.answer;
      if (cleanUserText.includes(qLower) || qLower.includes(cleanUserText)) return item.answer;

      // Check key phrases
      const cleanQWords = qLower.replace(/[^\w\s\u0900-\u097F]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
      const matchedWords = cleanQWords.filter((w) => cleanUserText.includes(w));
      if (cleanQWords.length > 0 && matchedWords.length / cleanQWords.length >= 0.75) {
        return item.answer;
      }
    }
    return null;
  };

  /**
   * Parse explicit navigation directives like [[NAV:type:target|label]]
   * And infer contextual navigation actions if none exist!
   */
  const parseNavigationDirectives = (rawContent: string, userQuery: string): { cleanContent: string; actions: ChatAction[] } => {
    let cleanContent = cleanBotText(rawContent);
    const actions: ChatAction[] = [];
    const seenActionIds = new Set<string>();

    const navRegex = /\[\[NAV:([^:|\]]+):?([^|\]]*)\|?([^\]]*)\]\]/g;
    let match: RegExpExecArray | null;

    while ((match = navRegex.exec(rawContent)) !== null) {
      const typeStr = match[1]?.trim() || '';
      const targetStr = match[2]?.trim() || '';
      const labelStr = match[3]?.trim() || '';

      const actionId = `act-${typeStr}-${targetStr}-${actions.length}`;
      if (!seenActionIds.has(actionId)) {
        seenActionIds.add(actionId);

        if (typeStr === 'page') {
          actions.push({
            id: actionId,
            type: 'navigate',
            target: targetStr as PageType,
            label: labelStr || `पेज खोलें`
          });
        } else if (typeStr === 'login') {
          actions.push({
            id: actionId,
            type: 'open_login',
            loginMode: (targetStr as any) || 'login',
            label: labelStr || `लॉगिन खोलें`
          });
        } else if (typeStr === 'plan') {
          actions.push({
            id: actionId,
            type: 'select_plan',
            planId: Number(targetStr) || 1,
            label: labelStr || `Plan 0${targetStr} चुनें`
          });
        } else if (typeStr === 'whatsapp') {
          actions.push({
            id: actionId,
            type: 'whatsapp',
            target: `https://wa.me/${targetStr || '918877490845'}?text=${encodeURIComponent('नमस्ते IOIS हेल्पडेस्क, मुझे सहायता चाहिए।')}`,
            label: labelStr || `व्हाट्सएप सहायता (+91 8877490845)`
          });
        } else if (typeStr === 'external') {
          actions.push({
            id: actionId,
            type: 'external_link',
            target: targetStr,
            label: labelStr || `वेबसाइट खोलें`
          });
        }
      }
    }

    // Strip raw NAV markers from display text
    cleanContent = cleanBotText(cleanContent.replace(navRegex, ''));

    // Contextual fallback action generation if no actions found
    if (actions.length === 0) {
      const combined = `${userQuery.toLowerCase()} ${cleanContent.toLowerCase()}`;

      if (combined.includes('balvikas') || combined.includes('bal vikas') || combined.includes('बाल विकास') || combined.includes('chintu') || combined.includes('चिंटू')) {
        actions.push({ id: 'auto-bv-plan', type: 'select_plan', planId: 1, label: '📖 Plan 01 (₹10) बाल विकास चुनें' });
        actions.push({ id: 'auto-bv-ext', type: 'external_link', target: 'https://ioisplatform.github.io/balvikas/', label: '🌐 बाल विकास लाइव पोर्टल' });
      } else if (combined.includes('रजिस्टर') || combined.includes('register') || combined.includes('खाता') || combined.includes('join')) {
        actions.push({ id: 'auto-reg', type: 'navigate', target: 'register', label: '📝 नया रजिस्ट्रेशन फॉर्म खोलें' });
        actions.push({ id: 'auto-plans', type: 'navigate', target: 'plans', label: '💎 7 मास्टर प्लांस देखें' });
      } else if (combined.includes('login') || combined.includes('लॉगिन') || combined.includes('पासवर्ड') || combined.includes('password') || combined.includes('user id')) {
        actions.push({ id: 'auto-login', type: 'open_login', loginMode: 'login', label: '🔐 सदस्य लॉगिन खोलें' });
        actions.push({ id: 'auto-fpass', type: 'open_login', loginMode: 'forgot_password', label: '🔑 पासवर्ड रीसेट करें' });
        actions.push({ id: 'auto-fuid', type: 'open_login', loginMode: 'forgot_user_id', label: '🔍 User ID खोजें' });
      } else if (combined.includes('15') || combined.includes('test') || combined.includes('इंटरव्यू') || combined.includes('interview') || combined.includes('असेसमेंट') || combined.includes('कौशल')) {
        actions.push({ id: 'auto-test', type: 'navigate', target: 'assessment', label: '🎯 15-सवाल कौशल टेस्ट शुरू करें' });
        actions.push({ id: 'auto-plans', type: 'navigate', target: 'plans', label: '💎 7 मास्टर प्लांस देखें' });
      } else if (combined.includes('id card') || combined.includes('कार्ड') || combined.includes('आईडी कार्ड')) {
        actions.push({ id: 'auto-idcard', type: 'navigate', target: 'idcard', label: '🪪 डिजिटल ID कार्ड खोलें' });
        actions.push({ id: 'auto-login', type: 'open_login', loginMode: 'login', label: '🔐 सदस्य लॉगिन करें' });
      } else if (combined.includes('study') || combined.includes('पढ़ाई') || combined.includes('पढ़ाई') || combined.includes('formula') || combined.includes('सूत्र') || combined.includes('कक्षा') || combined.includes('ncert') || combined.includes('नोट्स') || combined.includes('notes') || combined.includes('scholarship') || combined.includes('bonafide')) {
        actions.push({ id: 'auto-study', type: 'navigate', target: 'student-study', label: '📚 विद्यार्थी शिक्षा व नोट्स हब खोलें' });
      } else if (combined.includes('rtps') || combined.includes('जाति') || combined.includes('आय') || combined.includes('निवास') || combined.includes('दाखिल खारिज') || combined.includes('mutation') || combined.includes('pan') || combined.includes('पैन')) {
        actions.push({ id: 'auto-rtps', type: 'navigate', target: 'rtps-services', label: '🏛️ RTPS नागरिक सेवाएं व जमीन सुधार' });
      } else if (combined.includes('plan') || combined.includes('प्लान') || combined.includes('₹10') || combined.includes('₹49') || combined.includes('₹99') || combined.includes('₹199') || combined.includes('₹299') || combined.includes('₹499') || combined.includes('₹999')) {
        actions.push({ id: 'auto-plans', type: 'navigate', target: 'plans', label: '💎 7 मास्टर प्लांस देखें' });
        actions.push({ id: 'auto-reg', type: 'navigate', target: 'register', label: '📝 नया रजिस्ट्रेशन करें' });
      } else if (combined.includes('payout') || combined.includes('पेआउट') || combined.includes('कमीशन') || combined.includes('calculator') || combined.includes('कमाई')) {
        actions.push({ id: 'auto-calc', type: 'navigate', target: 'calculator', label: '💰 पेआउट व आय कैलकुलेटर खोलें' });
        actions.push({ id: 'auto-plans', type: 'navigate', target: 'plans', label: '💎 7 मास्टर प्लांस देखें' });
      } else if (combined.includes('weather') || combined.includes('मौसम') || combined.includes('बारिश')) {
        actions.push({ id: 'auto-weather', type: 'navigate', target: 'weather', label: '🌦️ लाइव मौसम व वर्षा अलर्ट' });
      } else if (combined.includes('news') || combined.includes('समाचार') || combined.includes('टीवी') || combined.includes('tv')) {
        actions.push({ id: 'auto-news', type: 'navigate', target: 'news', label: '📺 24x7 लाइव न्यूज़ टीवी' });
      } else if (combined.includes('panchang') || combined.includes('पंचांग') || combined.includes('rashifal') || combined.includes('राशिफल')) {
        actions.push({ id: 'auto-panchang', type: 'navigate', target: 'panchang-rashifal', label: '🪐 दैनिक पंचांग व राशिफल' });
      } else if (combined.includes('mandi') || combined.includes('मंडी') || combined.includes('gold') || combined.includes('सोना') || combined.includes('चांदी')) {
        actions.push({ id: 'auto-mandi', type: 'navigate', target: 'mandi-market', label: '🌾 मंडी भाव व सोना-चांदी दरें' });
      } else if (combined.includes('job') || combined.includes('नौकरी') || combined.includes('vacancy')) {
        actions.push({ id: 'auto-jobs', type: 'navigate', target: 'jobs', label: '💼 सरकारी व प्राइवेट जॉब अलर्ट' });
      } else if (combined.includes('scheme') || combined.includes('योजना') || combined.includes('ayushman') || combined.includes('आयुष्मान')) {
        actions.push({ id: 'auto-schemes', type: 'navigate', target: 'govt-schemes', label: '🇮🇳 सरकारी योजनाएं पोर्टल देखें' });
      } else if (combined.includes('contact') || combined.includes('संपर्क') || combined.includes('whatsapp') || combined.includes('help')) {
        actions.push({
          id: 'auto-wa',
          type: 'whatsapp',
          target: 'https://wa.me/918877490845',
          label: '💬 व्हाट्सएप पर सीधी चैट करें'
        });
      }
    }

    return { cleanContent: cleanBotText(cleanContent), actions };
  };

  const handleExecuteAction = (action: ChatAction) => {
    if (action.type === 'navigate') {
      const page = action.target as PageType;
      if (onNavigate) {
        onNavigate(page);
        const pageMeta = ALL_SYSTEM_PAGES.find((p) => p.id === page);
        setNavSuccessMessage(`🚀 आप '${pageMeta ? pageMeta.title : page}' पेज पर पहुँच गए हैं!`);
        setTimeout(() => setNavSuccessMessage(null), 4000);
      }
    } else if (action.type === 'open_login') {
      if (onOpenLogin) {
        onOpenLogin(action.loginMode || 'login');
      }
    } else if (action.type === 'select_plan') {
      if (onSelectPlanForRegister) {
        onSelectPlanForRegister(action.planId || 1);
        if (onNavigate) onNavigate('register');
        setNavSuccessMessage(`Plan 0${action.planId || 1} चुन लिया गया है!`);
        setTimeout(() => setNavSuccessMessage(null), 4000);
      } else if (onNavigate) {
        onNavigate('register');
      }
    } else if (action.type === 'whatsapp') {
      const url = typeof action.target === 'string' ? action.target : 'https://wa.me/918877490845';
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (action.type === 'external_link') {
      if (action.target) {
        window.open(action.target as string, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      // 0. Real-Time Day and Date Match (Immediate <5ms client-side IST calculation)
      const isDateOrDayQuestion = 
        /aaj.*(day|din|vaar|var|tarikh|tareekh|tithi|samay|time|konsa|kaunsa|kya|date)/i.test(messageContent) ||
        /today.*(day|date|time)/i.test(messageContent) ||
        /what.*day.*today/i.test(messageContent) ||
        /kaun.*sa.*(din|day|vaar)/i.test(messageContent) ||
        /konsa.*(din|day|vaar)/i.test(messageContent) ||
        /aaj.*(somwar|mangalwar|budhwar|guruwar|shukrawar|shaniwar|ravivar)/i.test(messageContent) ||
        /आज.*(कौन|कौन्|दिन|वार|तारीख|तिथि|समय)/i.test(messageContent);

      if (isDateOrDayQuestion) {
        const live = getClientLiveIndianDate();
        const dateReply = `आज ${live.dayHi} (${live.dayEn}) है।

मुख्य विवरण:
• आज का दिन: ${live.dayHi} (${live.dayEn})
• आज की दिनांक: ${live.dateHi} (${live.dateEn})
• वर्तमान समय: ${live.timeStr} (भारतीय मानक समय - IST)
• दैनिक पंचांग व शुभ मुहूर्त: आज के दिन का चौघड़िया, राहुकाल, नक्षत्र एवं 12 राशियों का दैनिक राशिफल देखने के लिए नीचे दिए गए पंचांग बटन पर क्लिक करें।

[[NAV:page:panchang-rashifal|🪐 दैनिक वैदिक पंचांग व 12 राशिफल देखें]]
[[NAV:page:weather|🌦️ लाइव मौसम व वर्षा अलर्ट देखें]]`;

        const { cleanContent, actions } = parseNavigationDirectives(dateReply, messageContent);
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: cleanContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions,
          learned: true
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsLoading(false);
        return;
      }

      // 1. Check direct match in Firestore Knowledge Base first
      const directMatchAnswer = findDirectKnowledgeMatch(messageContent);
      if (directMatchAnswer) {
        const { cleanContent, actions } = parseNavigationDirectives(directMatchAnswer, messageContent);
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: cleanContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions,
          learned: true
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsLoading(false);
        return;
      }

      // 2. Query server chat API (with Gemini 3.8 Flash + Search Grounding)
      const historyPayload = messages
        .filter((m) => m.id !== 'msg-welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      let replyContent = '';
      let isGrounded = false;
      let searchQueries: string[] = [];
      let sources: Array<{ title: string; uri: string }> = [];

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageContent,
            history: historyPayload
          })
        });

        if (res.ok) {
          const data = await res.json();
          replyContent = data.reply;
          isGrounded = !!data.grounded;
          searchQueries = data.searchQueries || [];
          sources = data.sources || [];
        }
      } catch (e) {
        console.warn('Network chat error, using offline fallback', e);
      }

      if (!replyContent) {
        const lower = messageContent.toLowerCase();
        if (lower.includes('बिहार दिवस') || lower.includes('bihar diwas') || lower.includes('bihar day') || (lower.includes('बिहार') && lower.includes('दिवस'))) {
          replyContent = `बिहार दिवस (Bihar Diwas) हर वर्ष 22 मार्च को बड़े धूमधाम से मनाया जाता है।

यह दिन 22 मार्च 1912 को बंगाल प्रेसीडेंसी से अलग होकर बिहार राज्य के गठन का प्रतीक है।

मुख्य ऐतिहासिक व आवश्यक तथ्य:
• ऐतिहासिक पृष्ठभूमि: 22 मार्च 1912 को ब्रिटिश हुकूमत द्वारा बंगाल प्रेसीडेंसी से अलग कर बिहार को एक स्वतंत्र राज्य का दर्जा दिया गया था।
• राज्य पुनर्गठन: इसके बाद 1 अप्रैल 1936 को उड़ीसा (ओडिशा) और 15 नवंबर 2000 को दक्षिण बिहार से अलग होकर झारखंड राज्य अस्तित्व में आया।
• आधिकारिक उत्सव की शुरुआत: वर्ष 2010 में बिहार के मुख्यमंत्री श्री नीतीश कुमार ने 22 मार्च को व्यापक स्तर पर आधिकारिक 'बिहार दिवस' के रूप में मनाने की शुरुआत की।
• सार्वजनिक अवकाश: 22 मार्च को संपूर्ण बिहार राज्य में सार्वजनिक अवकाश (Public Holiday) रहता है।
• राज्यव्यापी उत्सव: राजधानी पटना के गांधी मैदान व सभी 38 जिलों में त्रिदिवसीय सांस्कृतिक, शैक्षिक व वैज्ञानिक कार्यक्रमों का भव्य आयोजन होता है।
• राजधानी: पटना | जिले: 38 | मुख्यमंत्री: श्री नीतीश कुमार | राज्यपाल: श्री राजेंद्र विश्वनाथ आर्लेकर

[[NAV:page:student-study|विद्यार्थी सामान्य ज्ञान व बिहार अध्ययन हब खोलें]]
[[NAV:external:https://ioisplatform.github.io/balvikas/|बाल विकास डिजिटल पुस्तक व चिंटू AI खोलें]]`;
          isGrounded = true;
          sources = [
            {
              title: 'बिहार दिवस (आधिकारिक विकिपीडिया संदर्भ)',
              uri: 'https://hi.wikipedia.org/wiki/%E0%A4%AC%E0%A4%BF%E0%A4%B9%E0%A4%BE%E0%A4%B0_%E0%A4%A6%E0%A4%BF%E0%A4%B5%E0%A4%B8'
            }
          ];
        } else if (lower.includes('bihar') && (lower.includes('capital') || lower.includes('rajdhani') || lower.includes('राजधानी'))) {
          replyContent = `बिहार की राजधानी पटना है।`;
        } else if (lower.includes('bihar') && (lower.includes('cm') || lower.includes('chief minister') || lower.includes('मुख्यमंत्री'))) {
          replyContent = `बिहार के वर्तमान मुख्यमंत्री श्री नीतीश कुमार हैं।`;
        } else if (lower.includes('bharat') || lower.includes('india') && (lower.includes('capital') || lower.includes('राजधानी'))) {
          replyContent = `भारत की राजधानी नई दिल्ली है।`;
        } else if (lower.includes('pm') || lower.includes('prime minister') || lower.includes('प्रधानमंत्री')) {
          replyContent = `भारत के प्रधानमंत्री श्री नरेन्द्र मोदी हैं।`;
        } else if (lower.includes('chintu') || lower.includes('चिंटू') || lower.includes('bal vikas') || lower.includes('balvikas') || lower.includes('बाल विकास')) {
          replyContent = `बाल विकास IOIS का प्रमुख डिजिटल शिक्षा कार्यक्रम है (Plan 01 मात्र ₹10)। इसमें कक्षा 1 से 5 तक 700+ पृष्ठों की डिजिटल पुस्तक, NCERT अभ्यास और 70% (₹7) पेआउट शामिल है। लाइव पोर्टल: https://ioisplatform.github.io/balvikas/\n\n[[NAV:plan:1|Plan 01 बाल विकास ₹10 सक्रिय करें]]\n[[NAV:external:https://ioisplatform.github.io/balvikas/|बाल विकास लाइव पोर्टल खोलें]]`;
        } else if (lower.includes('plan 1') || lower.includes('plan 01') || lower.includes('₹10')) {
          replyContent = `Plan 01: Bal Vikas Access (₹10)\n- संसाधन: Class 1-5 NCERT PDFs, Worksheets और Verification Pass।\n- इंसेंटिव: ₹7 इंस्टेंट पेआउट प्रति सफल रेफरल (70% Payout)।\n- किसके लिए: स्कूली छात्र और शुरुआती यूजर्स।\n\n[[NAV:plan:1|Plan 01 (₹10) एक्टिवेट करें]]\n[[NAV:page:plans|7 मास्टर प्लांस देखें]]`;
        } else if (lower.includes('plan 7') || lower.includes('plan 07') || lower.includes('₹999') || lower.includes('master')) {
          replyContent = `Plan 07: Lifetime Master Access (₹999)\n- संसाधन: सभी 6 प्लान्स का अनलॉक्ड एक्सेस + लाइफटाइम फ्री अपडेट्स + मास्टर रीसेलर राइट्स।\n- इंसेंटिव: ₹499 इंस्टेंट पेआउट प्रति रेफरल (50% सीधा पेआउट)।\n- संजय मॉडल: 20 लीडर्स को जोड़ने पर तुरंत ₹9,980 की शुद्ध कमाई!\n\n[[NAV:plan:7|Plan 07 (₹999) एक्टिवेट करें]]\n[[NAV:page:plans|सभी प्लांस देखें]]`;
        } else if (lower.includes('plan') || lower.includes('प्लान') || lower.includes('रेट')) {
          replyContent = `IOIS के सभी 7 प्लान्स का संक्षिप्त विवरण:\n\n1. Plan 01 (₹10): ₹7 इंस्टेंट पेआउट (70%)\n2. Plan 02 (₹49): ₹34 इंस्टेंट पेआउट (70%)\n3. Plan 03 (₹99): ₹64 इंस्टेंट पेआउट (65%)\n4. Plan 04 (₹199): ₹119 इंस्टेंट पेआउट (60%)\n5. Plan 05 (₹299): ₹179 इंस्टेंट पेआउट (60%)\n6. Plan 06 (₹499): ₹274 इंस्टेंट पेआउट (55%)\n7. Plan 07 (₹999): ₹499 इंस्टेंट पेआउट (50%)\n\n[[NAV:page:plans|7 मास्टर प्लांस विवरण देखें]]\n[[NAV:page:register|नया रजिस्ट्रेशन करें]]`;
        } else if (lower.includes('payout') || lower.includes('पेआउट') || lower.includes('पैसे') || lower.includes('कमाई')) {
          replyContent = `IOIS में स्मार्ट इंस्टेंट पेआउट प्रोटोकॉल है। जब भी आपके रेफरल से कोई यूजर वेरिफाई होता है, उसका पैसा (₹7 से ₹499) तुरंत आपके खाते/वॉलेट में ट्रांसफर कर दिया जाता है।\n\n[[NAV:page:calculator|पेआउट व आय कैलकुलेटर खोलें]]`;
        } else if (lower.includes('contact') || lower.includes('संपर्क') || lower.includes('whatsapp') || lower.includes('help')) {
          replyContent = `आप हमसे सीधे संपर्क कर सकते हैं:\n- WhatsApp Support: +91 8877490845\n- Official Telegram: @ioisplatform\n- Email: ioisplatform@gmail.com\n\n[[NAV:whatsapp:918877490845|व्हाट्सएप पर संपर्क करें (+91 8877490845)]]`;
        } else {
          syncUnansweredToFirestore({
            id: `unans-${Date.now()}`,
            question: messageContent,
            askedAt: new Date().toISOString(),
            status: 'pending'
          });

          replyContent = `नमस्ते! मैं IOIS बाल विकास चिंटू AI शिक्षक हूँ।\n\nआप मुझसे IOIS प्लेटफॉर्म, 7 डिजिटल प्लांस (₹10 से ₹999), 15-सवाल कौशल साक्षात्कार, कक्षा 1-12 NCERT नोट्स या सरकारी नागरिक सेवाओं के बारे में कोई भी सीधा सवाल पूछ सकते हैं।\n\n[[NAV:page:register|नया रजिस्ट्रेशन पोर्टल खोलें]]\n[[NAV:page:assessment|15-सवाल असेसमेंट दें]]\n[[NAV:page:plans|7 मास्टर प्लांस देखें]]\n[[NAV:page:student-study|विद्यार्थी शिक्षा व नोट्स खोलें]]\n[[NAV:whatsapp:918877490845|व्हाट्सएप हेल्पलाइन (+91 8877490845)]]`;
        }
      }

      const { cleanContent, actions } = parseNavigationDirectives(replyContent, messageContent);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        grounded: isGrounded,
        searchQueries,
        sources,
        actions
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat Error:', err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'सॉरी, नेटवर्क से जुड़ने में समस्या हुई। कृपया हमारे आधिकारिक व्हाट्सएप सपोर्ट +91 8877490845 पर संपर्क करें।',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          {
            id: 'err-wa',
            type: 'whatsapp',
            target: 'https://wa.me/918877490845',
            label: '💬 व्हाट्सएप पर तुरंत सहायता लें'
          }
        ]
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: `नमस्ते! चैट रीसेट हो गई है। आप IOIS के किसी भी सिस्टम, सेवा, 7 प्लांस या शैक्षणिक विषय पर नया प्रश्न पूछ सकते हैं।`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          { id: 'act-reg', label: '📝 नया सदस्य रजिस्ट्रेशन', type: 'navigate', target: 'register' },
          { id: 'act-plans', label: '💎 7 मास्टर प्लांस', type: 'navigate', target: 'plans' },
          { id: 'act-quiz', label: '🎯 15-सवाल कौशल साक्षात्कार', type: 'navigate', target: 'assessment' },
          { id: 'act-id', label: '🪪 डिजिटल ID कार्ड', type: 'navigate', target: 'idcard' }
        ]
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div
      id="ai-chatbot-drawer"
      className="fixed bottom-3 sm:bottom-4 right-2 sm:right-4 z-50 w-[96vw] sm:w-[460px] max-w-[490px] shadow-2xl rounded-3xl overflow-hidden border-2 border-amber-500/60 bg-slate-950/98 backdrop-blur-2xl flex flex-col transition-all duration-300 animate-fadeIn"
      style={{ height: isMinimized ? '64px' : '650px', maxHeight: '90vh' }}
    >
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/60 to-slate-900 px-3.5 py-3 border-b border-amber-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-400 to-green-500 p-0.5 flex items-center justify-center shadow-md">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
              <Bot className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-white font-black text-xs sm:text-sm leading-none">IOIS Smart AI Navigator</h4>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </div>
            <p className="text-[10px] text-amber-300/90 font-medium leading-none mt-1">बाल विकास चिंटू AI शिक्षक • सीधा व सटीक उत्तर</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Direct System Navigator Toggle */}
          <button
            onClick={() => setShowNavigator(!showNavigator)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
              showNavigator 
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm' 
                : 'bg-slate-800/80 text-amber-300 hover:bg-slate-700 border-amber-500/30'
            }`}
            title="सभी सिस्टम डायरेक्टरी खोलें"
          >
            <Compass className="w-3 h-3" />
            <span className="hidden sm:inline">सिस्टम्स</span>
          </button>

          <button
            onClick={handleClearChat}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="चैट साफ करें"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title={isMinimized ? 'बड़ा करें' : 'छोटा करें'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="बंद करें"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Success Notification Toast */}
      {navSuccessMessage && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white px-3 py-1.5 text-[11px] font-bold flex items-center justify-between animate-fadeIn z-20">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
            <span>{navSuccessMessage}</span>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] font-black uppercase transition cursor-pointer"
          >
            पेज देखें
          </button>
        </div>
      )}

      {/* Main Chat Area (Only if not minimized) */}
      {!isMinimized && (
        <>
          {/* Systems Directory Overlay when open */}
          {showNavigator ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-800 bg-slate-950">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-amber-400" />
                  <h3 className="text-white font-black text-xs">IOIS संपूर्ण सिस्टम डायरेक्टरी</h3>
                </div>
                <button
                  onClick={() => setShowNavigator(false)}
                  className="text-[10px] text-slate-400 hover:text-white bg-slate-800 px-2 py-0.5 rounded cursor-pointer"
                >
                  चैट पर लौटें ✕
                </button>
              </div>

              <p className="text-[11px] text-slate-300">
                किसी भी सिस्टम पर क्लिक करें, आप सीधे उस सेक्शन/पेज पर पहुँच जाएंगे:
              </p>

              <div className="grid grid-cols-1 gap-2">
                {ALL_SYSTEM_PAGES.map((sys) => (
                  <button
                    key={sys.id}
                    onClick={() => {
                      if (onNavigate) {
                        onNavigate(sys.id);
                        setNavSuccessMessage(`🚀 आप '${sys.title}' पेज पर पहुँच गए हैं!`);
                        setShowNavigator(false);
                        setTimeout(() => setNavSuccessMessage(null), 4000);
                      }
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 transition flex items-center justify-between group cursor-pointer"
                  >
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-300 group-hover:text-amber-200">{sys.title}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">{sys.category}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 group-hover:text-slate-300 leading-snug">{sys.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition shrink-0" />
                  </button>
                ))}
              </div>

              {/* Quick Auth Actions in Navigator */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <span className="text-[11px] font-black text-amber-300 block">🔐 सदस्य खाता नियंत्रण:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      if (onOpenLogin) onOpenLogin('login');
                      setShowNavigator(false);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-black text-center transition cursor-pointer"
                  >
                    लॉगिन
                  </button>
                  <button
                    onClick={() => {
                      if (onOpenLogin) onOpenLogin('forgot_password');
                      setShowNavigator(false);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold text-center border border-amber-500/30 transition cursor-pointer"
                  >
                    पासवर्ड रीसेट
                  </button>
                  <button
                    onClick={() => {
                      if (onOpenLogin) onOpenLogin('forgot_user_id');
                      setShowNavigator(false);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 text-[10px] font-bold text-center border border-blue-500/30 transition cursor-pointer"
                  >
                    User ID खोजें
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs scrollbar-thin scrollbar-thumb-slate-800 bg-slate-950/85">
              {messages.map((msg) => {
                const isAssistant = msg.role === 'assistant';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                  >
                    {isAssistant && (
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] rounded-2xl p-3.5 space-y-2 ${
                        isAssistant
                          ? 'bg-slate-900/95 text-slate-200 border border-slate-800'
                          : 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-medium'
                      }`}
                    >
                      {isAssistant && msg.grounded && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-bold w-fit">
                          <Globe className="w-3 h-3 text-blue-400" />
                          <span>लाइव वेब रिसर्च से सत्यापित</span>
                        </div>
                      )}

                      {isAssistant && msg.learned && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold w-fit">
                          <ShieldCheck className="w-3 h-3 text-amber-400" />
                          <span>IOIS आधिकारिक ज्ञानकोश उत्तर</span>
                        </div>
                      )}

                      <div className="whitespace-pre-wrap leading-relaxed">
                        {cleanBotText(msg.content)}
                      </div>

                      {/* Interactive Navigation CTA Actions inside Assistant Bubble */}
                      {isAssistant && msg.actions && msg.actions.length > 0 && (
                        <div className="pt-2.5 mt-2 border-t border-slate-800/80 space-y-1.5">
                          <span className="text-[10px] font-black text-amber-400/90 uppercase tracking-wider flex items-center gap-1">
                            <Compass className="w-3 h-3" />
                            <span>त्वरित इन-ऐप नेविगेशन (Click to Open):</span>
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.actions.map((act) => (
                              <button
                                key={act.id}
                                onClick={() => handleExecuteAction(act)}
                                className="text-[11px] font-bold bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-amber-500/20 hover:from-amber-400 hover:to-amber-500 text-amber-300 hover:text-slate-950 border border-amber-400/40 hover:border-amber-400 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer group"
                              >
                                <span>{act.label}</span>
                                <ArrowRight className="w-3 h-3 text-amber-400 group-hover:text-slate-950 group-hover:translate-x-0.5 transition" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {isAssistant && msg.sources && msg.sources.length > 0 && (
                        <div className="pt-2 mt-2 border-t border-slate-800/80 space-y-1">
                          <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <ExternalLink className="w-2.5 h-2.5" />
                            <span>सत्यापित स्रोत (Sources):</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.slice(0, 3).map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] bg-slate-950 hover:bg-slate-800 text-blue-300 border border-slate-800 px-2 py-0.5 rounded-lg truncate max-w-[200px] flex items-center gap-1 transition"
                              >
                                <span className="truncate">{src.title || 'वेब संदर्भ'}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Message Footer: Actions & Timestamp */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          {isAssistant && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSpeak(msg.content, msg.id)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition"
                                title={speakingMsgId === msg.id ? "आवाज़ बंद करें" : "उत्तर बोलकर सुनें (Listen)"}
                              >
                                {speakingMsgId === msg.id ? <VolumeX className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> : <Volume2 className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(msg.content, msg.id)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition"
                                title="उत्तर कॉपी करें (Copy)"
                              >
                                {copiedMsgId === msg.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          )}
                        </div>
                        <div className={`text-[9px] font-semibold ${isAssistant ? 'text-slate-500' : 'text-slate-900/80'}`}>
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>

                    {!isAssistant && (
                      <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  </div>
                  <div className="bg-slate-900 rounded-2xl p-3.5 border border-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    <span className="text-[11px] text-slate-400 ml-2">AI उत्तर व सही लिंक तैयार कर रहा है...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Quick Preset Questions Chips */}
          <div className="px-3 py-2 bg-slate-900/95 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {[
              '📅 आज कौन सा दिन व तारीख है?',
              '📖 बाल विकास Plan 01 (₹10)',
              '💎 7 मास्टर प्लांस और पेआउट',
              '🪪 ID कार्ड कैसे डाउनलोड करें?',
              '🎯 15-सवाल कौशल इंटरव्यू कैसे दें?',
              '🏛️ जाति, आय, निवास प्रमाण पत्र (RTPS)',
              '🌾 मंडी भाव व सोना-चांदी दरें',
              '💰 पेआउट व कमीशन कैलकुलेटर',
              '🌦️ लाइव मौसम व बारिश अलर्ट',
              '📞 व्हाट्सएप हेल्पलाइन +91 8877490845'
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (showNavigator) setShowNavigator(false);
                  handleSendMessage(chip);
                }}
                className={`text-[10px] px-2.5 py-1 rounded-full shrink-0 transition cursor-pointer border ${
                  idx === 0 
                    ? 'bg-amber-400 text-slate-950 font-black border-amber-300 shadow-sm'
                    : 'bg-slate-950 hover:bg-slate-800 border-amber-500/30 text-amber-300'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Input Field with Voice Mic & Send */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (showNavigator) setShowNavigator(false);
              handleSendMessage();
            }}
            className="p-2.5 sm:p-3 bg-slate-950 border-t border-amber-500/20 flex items-center gap-2"
          >
            {/* Mic Button for Speech-to-Text */}
            <button
              type="button"
              onClick={startVoiceInput}
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border transition cursor-pointer ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                  : 'bg-slate-900 hover:bg-slate-850 text-amber-400 border-slate-700'
              }`}
              title={isListening ? "सुन रहा है... बोलिए" : "माइक से बोलकर पूछें (Voice Typing)"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              id="ai-chatbot-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "सुन रहा हूँ, कृपया बोलिए..." : "IOIS सिस्टम, आज का दिन, प्लांस या सेवाओं पर पूछें..."}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 transition"
              disabled={isLoading}
            />
            <button
              id="ai-chatbot-send-btn"
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black flex items-center justify-center shrink-0 disabled:opacity-50 transition shadow-md cursor-pointer"
              title="भेजें"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
