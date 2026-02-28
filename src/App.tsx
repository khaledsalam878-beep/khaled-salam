import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, User, Mail, PlayCircle, Plus, CreditCard, 
  Wallet, CheckCircle, XCircle, LogOut, Bot, Send, X, 
  ShieldAlert, Youtube, Copy, Phone, Clock, FileQuestion, AlertTriangle
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, updateDoc, doc, query, where, onSnapshot, setDoc, serverTimestamp, orderBy } from 'firebase/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type ViewState = 'login' | 'signup' | 'admin' | 'student';
type Question = { question: string; options: string[]; correctIndex: number };
type Lesson = { id: string; title: string; url: string; youtubeId: string; duration: number; questions: Question[]; grade: string; studyType: string; createdAt?: any };
type RechargeCode = { id: string; code: string; value: number; used: boolean; createdAt?: any };

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('login');
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentView !== 'admin') {
        setCurrentView('student');
      }
    });
    return unsubscribe;
  }, [currentView]);

  useEffect(() => {
    if (user && currentView === 'student') {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setUserData(docSnap.data());
          setWalletBalance(docSnap.data().walletBalance || 0);
        }
      });
      return unsub;
    }
  }, [user, currentView]);

  const handleLogout = async () => {
    if (user) {
      await signOut(auth);
    }
    setCurrentView('login');
    setUser(null);
    setUserData(null);
    setWalletBalance(0);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans selection:bg-purple-500/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {(currentView === 'admin' || currentView === 'student') && (
          <nav className="bg-[#131B2F]/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <ShieldAlert className="text-white w-6 h-6" />
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-white to-slate-400">
                  أكاديمية النخبة
                </h1>
              </div>
              <div className="hidden md:flex items-center text-xs text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                المطور خالد سلام 01222652380
              </div>
              <div className="flex items-center gap-4">
                {currentView === 'student' && (
                  <div className="hidden sm:flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-full border border-white/5">
                    <Wallet className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-white">{walletBalance} ج.م</span>
                  </div>
                )}
                <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <span className="hidden sm:inline">تسجيل خروج</span>
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </nav>
        )}

        <main className="flex-1 flex flex-col">
          {currentView === 'login' && <AuthView type="login" setView={setCurrentView} />}
          {currentView === 'signup' && <AuthView type="signup" setView={setCurrentView} />}
          {currentView === 'admin' && <AdminDashboard />}
          {currentView === 'student' && <StudentDashboard walletBalance={walletBalance} user={user} userData={userData} />}
        </main>

        {currentView === 'student' && <ChatbotWidget />}
      </div>
    </div>
  );
}

function AuthView({ type, setView }: { type: 'login' | 'signup', setView: (v: ViewState) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [grade, setGrade] = useState('الصف الأول الثانوي');
  const [studyType, setStudyType] = useState('سنتر');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Admin Bypass
    if (type === 'login' && email === 'admin@admin.com' && password === 'admin123') {
      setView('admin');
      return;
    }

    setLoading(true);
    try {
      if (type === 'signup') {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCred.user.uid), {
          name,
          email,
          parentPhone,
          grade,
          studyType,
          walletBalance: 0,
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#131B2F]/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl shadow-purple-900/20">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {type === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </h2>
          <p className="text-slate-400">مرحباً بك في منصة النخبة التعليمية</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {type === 'signup' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">الاسم بالكامل</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 pr-11 pl-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all" placeholder="أحمد محمد" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">رقم هاتف ولي الأمر (للمتابعة)</label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input required type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)} className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 pr-11 pl-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-left" dir="ltr" placeholder="01xxxxxxxxx" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">السنة الدراسية</label>
                  <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all">
                    <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                    <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                    <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">نوع الدراسة</label>
                  <select value={studyType} onChange={e => setStudyType(e.target.value)} className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all">
                    <option value="سنتر">سنتر</option>
                    <option value="اونلاين">اونلاين</option>
                  </select>
                </div>
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 pr-11 pl-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-left" dir="ltr" placeholder="student@example.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 pr-11 pl-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all" placeholder="••••••••" />
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
            >
              {loading ? 'جاري التحميل...' : (type === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب')}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          {type === 'login' ? (
            <p>ليس لديك حساب؟ <button onClick={() => setView('signup')} className="text-purple-400 hover:text-purple-300 font-bold">سجل الآن</button></p>
          ) : (
            <p>لديك حساب بالفعل؟ <button onClick={() => setView('login')} className="text-purple-400 hover:text-purple-300 font-bold">تسجيل الدخول</button></p>
          )}
        </div>
        
        <div className="mt-8 pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-slate-500 font-medium">المطور خالد سلام 01222652380</p>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [codes, setCodes] = useState<RechargeCode[]>([]);
  
  // Lesson Form State
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [duration, setDuration] = useState(10);
  const [lessonGrade, setLessonGrade] = useState('الصف الأول الثانوي');
  const [lessonStudyType, setLessonStudyType] = useState('سنتر');
  const [questions, setQuestions] = useState<Question[]>([{ question: '', options: ['', '', '', ''], correctIndex: 0 }]);
  
  const [codeValue, setCodeValue] = useState('50');

  useEffect(() => {
    const qLessons = query(collection(db, 'lessons'), orderBy('createdAt', 'desc'));
    const unsubLessons = onSnapshot(qLessons, (snap) => {
      setLessons(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)));
    });

    const qCodes = query(collection(db, 'codes'), orderBy('createdAt', 'desc'));
    const unsubCodes = onSnapshot(qCodes, (snap) => {
      setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as RechargeCode)));
    });

    return () => { unsubLessons(); unsubCodes(); };
  }, []);

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const ytId = getYouTubeId(url);
    if (!ytId) return alert('رابط يوتيوب غير صحيح');
    
    // Validate questions
    for (const q of questions) {
      if (!q.question.trim() || q.options.some(opt => !opt.trim())) {
        return alert('يرجى إكمال جميع حقول الأسئلة والخيارات');
      }
    }

    await addDoc(collection(db, 'lessons'), {
      title,
      url,
      youtubeId: ytId,
      duration,
      grade: lessonGrade,
      studyType: lessonStudyType,
      questions,
      createdAt: serverTimestamp()
    });
    
    setTitle('');
    setUrl('');
    setDuration(10);
    setLessonGrade('الصف الأول الثانوي');
    setLessonStudyType('سنتر');
    setQuestions([{ question: '', options: ['', '', '', ''], correctIndex: 0 }]);
    alert('تم إضافة المحاضرة والامتحان بنجاح!');
  };

  const handleGenerateCode = async () => {
    const randomCode = Math.random().toString(36).substring(2, 12).toUpperCase();
    const formattedCode = `${randomCode.slice(0,5)}-${randomCode.slice(5)}`;
    await addDoc(collection(db, 'codes'), {
      code: formattedCode,
      value: Number(codeValue),
      used: false,
      createdAt: serverTimestamp()
    });
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const newQ = [...questions];
    if (field === 'question') newQ[index].question = value;
    if (field === 'correctIndex') newQ[index].correctIndex = value;
    setQuestions(newQ);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const newQ = [...questions];
    newQ[qIndex].options[optIndex] = value;
    setQuestions(newQ);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Add Lesson Section */}
        <div className="bg-[#131B2F]/80 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
              <Youtube className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">إضافة محاضرة وامتحان</h2>
          </div>
          
          <form onSubmit={handleAddLesson} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">عنوان المحاضرة</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="مثال: الفصل الأول - الدرس الأول" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">رابط يوتيوب</label>
              <input required value={url} onChange={e => setUrl(e.target.value)} type="url" className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-left" dir="ltr" placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">مدة الامتحان (بالدقائق)</label>
              <input required value={duration} onChange={e => setDuration(Number(e.target.value))} type="number" min="1" className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">السنة الدراسية</label>
                <select value={lessonGrade} onChange={e => setLessonGrade(e.target.value)} className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                  <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                  <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                  <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">نوع الدراسة</label>
                <select value={lessonStudyType} onChange={e => setLessonStudyType(e.target.value)} className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                  <option value="سنتر">سنتر</option>
                  <option value="اونلاين">اونلاين</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <FileQuestion className="w-5 h-5 text-purple-400" /> أسئلة الامتحان
              </h3>
              {questions.map((q, qIndex) => (
                <div key={qIndex} className="bg-[#0B0F19] p-4 rounded-xl border border-white/5 mb-4 space-y-3">
                  <input required value={q.question} onChange={e => updateQuestion(qIndex, 'question', e.target.value)} type="text" className="w-full bg-[#131B2F] border border-white/10 rounded-lg py-2 px-3 text-white outline-none" placeholder={`السؤال ${qIndex + 1}`} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, optIndex) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <input type="radio" name={`correct-${qIndex}`} checked={q.correctIndex === optIndex} onChange={() => updateQuestion(qIndex, 'correctIndex', optIndex)} className="text-purple-500 focus:ring-purple-500 bg-[#131B2F] border-white/10" />
                        <input required value={opt} onChange={e => updateOption(qIndex, optIndex, e.target.value)} type="text" className="flex-1 bg-[#131B2F] border border-white/10 rounded-lg py-1.5 px-3 text-white outline-none text-sm" placeholder={`خيار ${optIndex + 1}`} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setQuestions([...questions, { question: '', options: ['', '', '', ''], correctIndex: 0 }])} className="text-sm text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1">
                <Plus className="w-4 h-4" /> إضافة سؤال آخر
              </button>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4">
              <Plus className="w-5 h-5" /> حفظ المحاضرة والامتحان
            </button>
          </form>
        </div>

        {/* Code Generator Section */}
        <div className="bg-[#131B2F]/80 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-xl h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">توليد أكواد الشحن</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">قيمة الكود (ج.م)</label>
              <select value={codeValue} onChange={e => setCodeValue(e.target.value)} className="w-full bg-[#0B0F19] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none appearance-none">
                <option value="50">50 جنيه</option>
                <option value="100">100 جنيه</option>
                <option value="200">200 جنيه</option>
                <option value="500">500 جنيه</option>
              </select>
            </div>
            <button onClick={handleGenerateCode} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              <Bot className="w-5 h-5" /> توليد كود جديد
            </button>
          </div>
        </div>
      </div>

      {/* Codes Table */}
      <div className="bg-[#131B2F]/80 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-xl overflow-hidden">
        <h2 className="text-xl font-bold text-white mb-6">الأكواد المُصدرة</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-sm">
                <th className="pb-3 font-medium">الكود</th>
                <th className="pb-3 font-medium">القيمة</th>
                <th className="pb-3 font-medium">الحالة</th>
                <th className="pb-3 font-medium text-center">نسخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {codes.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-500">لا توجد أكواد حالياً</td></tr>
              ) : (
                codes.map((c: RechargeCode) => (
                  <tr key={c.id} className="text-slate-200">
                    <td className="py-4 font-mono text-purple-300" dir="ltr">{c.code}</td>
                    <td className="py-4 font-bold">{c.value} ج.م</td>
                    <td className="py-4">
                      {c.used ? (
                        <span className="inline-flex items-center gap-1 text-red-400 bg-red-400/10 px-2 py-1 rounded-md text-xs">
                          <XCircle className="w-3 h-3" /> مستخدم
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md text-xs">
                          <CheckCircle className="w-3 h-3" /> متاح
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      <button onClick={() => navigator.clipboard.writeText(c.code)} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white">
                        <Copy className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StudentDashboard({ walletBalance, user, userData }: { walletBalance: number, user: any, userData: any }) {
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [rechargeInput, setRechargeInput] = useState('');
  const [rechargeMsg, setRechargeMsg] = useState({ text: '', type: '' });
  
  const [activeQuiz, setActiveQuiz] = useState<Lesson | null>(null);

  useEffect(() => {
    const qLessons = query(collection(db, 'lessons'), orderBy('createdAt', 'desc'));
    const unsubLessons = onSnapshot(qLessons, (snap) => {
      setAllLessons(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)));
    });

    if (user) {
      const qProgress = query(collection(db, 'progress'), where('userId', '==', user.uid));
      const unsubProgress = onSnapshot(qProgress, (snap) => {
        const progMap: Record<string, any> = {};
        snap.docs.forEach(d => {
          progMap[d.data().lessonId] = d.data();
        });
        setProgress(progMap);
      });
      return () => { unsubLessons(); unsubProgress(); };
    }
    
    return () => unsubLessons();
  }, [user]);

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const q = query(collection(db, 'codes'), where('code', '==', rechargeInput.trim()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      setRechargeMsg({ text: 'الكود غير صحيح', type: 'error' });
      return;
    }
    
    const codeDoc = snapshot.docs[0];
    const codeData = codeDoc.data() as RechargeCode;

    if (codeData.used) {
      setRechargeMsg({ text: 'هذا الكود مستخدم مسبقاً', type: 'error' });
      return;
    }

    await updateDoc(doc(db, 'codes', codeDoc.id), { used: true, usedBy: user.uid, usedAt: serverTimestamp() });
    await updateDoc(doc(db, 'users', user.uid), { walletBalance: walletBalance + codeData.value });
    
    setRechargeMsg({ text: `تم شحن ${codeData.value} ج.م بنجاح!`, type: 'success' });
    setRechargeInput('');
    setTimeout(() => setRechargeMsg({ text: '', type: '' }), 3000);
  };

  const handleLessonAction = (lesson: Lesson) => {
    const isPassed = progress[lesson.id]?.status === 'Pass';
    if (!isPassed) {
      setActiveQuiz(lesson);
    }
  };

  const lessons = allLessons.filter(l => {
    if (!userData?.grade || !userData?.studyType) return true;
    return l.grade === userData.grade && l.studyType === userData.studyType;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      
      {activeQuiz && (
        <QuizModal 
          lesson={activeQuiz} 
          user={user} 
          userData={userData}
          onClose={() => setActiveQuiz(null)} 
        />
      )}

      {/* Wallet & Recharge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-purple-900/80 to-blue-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl" />
          <div className="relative z-10 mb-4">
            <h2 className="text-xl font-bold text-white mb-1">مرحباً، {userData?.name || 'طالب'}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-1 rounded-md bg-white/10 text-purple-200">
                {userData?.grade || 'غير محدد'}
              </span>
              <span className="text-xs font-medium px-2 py-1 rounded-md bg-white/10 text-blue-200">
                {userData?.studyType || 'غير محدد'}
              </span>
            </div>
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-purple-200 mb-2">
              <Wallet className="w-5 h-5" />
              <h3 className="font-medium">رصيد المحفظة</h3>
            </div>
            <div className="text-4xl font-bold text-white tracking-tight">
              {walletBalance} <span className="text-xl text-purple-300 font-normal">ج.م</span>
            </div>
          </div>
        </div>

        <div className="bg-[#131B2F]/80 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-xl">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" /> شحن الرصيد
          </h3>
          <form onSubmit={handleRecharge} className="flex gap-2">
            <input 
              type="text" value={rechargeInput} onChange={e => setRechargeInput(e.target.value)}
              className="flex-1 bg-[#0B0F19] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-center font-mono tracking-widest uppercase"
              placeholder="XXXXX-XXXXX" dir="ltr"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 rounded-xl transition-colors shrink-0">
              تفعيل
            </button>
          </form>
          {rechargeMsg.text && (
            <p className={`mt-3 text-sm font-medium ${rechargeMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {rechargeMsg.text}
            </p>
          )}
        </div>
      </div>

      {/* Lessons */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <PlayCircle className="w-6 h-6 text-purple-500" /> المحاضرات المتاحة
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessons.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-[#131B2F]/50 rounded-3xl border border-white/5">
              لا توجد محاضرات متاحة حالياً
            </div>
          ) : (
            lessons.map((lesson: Lesson) => {
              const isPassed = progress[lesson.id]?.status === 'Pass';
              
              return (
                <div key={lesson.id} className="bg-[#131B2F]/80 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden shadow-xl group relative">
                  
                  {!isPassed && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center">
                      <Lock className="w-12 h-12 text-purple-500 mb-3" />
                      <h3 className="text-white font-bold mb-2 text-lg">المحاضرة مغلقة</h3>
                      <p className="text-sm text-slate-300 mb-6">عذراً، يجب دخول الامتحان واجتيازه أولاً لفتح المحاضرة.</p>
                      <button 
                        onClick={() => handleLessonAction(lesson)}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/25"
                      >
                        <FileQuestion className="w-5 h-5" /> ابدأ الامتحان ({lesson.duration} دقيقة)
                      </button>
                    </div>
                  )}

                  <div className={`relative pt-[56.25%] bg-black ${!isPassed ? 'opacity-30 pointer-events-none' : ''}`}>
                    <iframe 
                      src={`https://www.youtube.com/embed/${lesson.youtubeId}?rel=0&modestbranding=1`}
                      title={lesson.title}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/20">
                        {lesson.grade || 'غير محدد'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/20">
                        {lesson.studyType || 'غير محدد'}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-lg line-clamp-2 leading-snug group-hover:text-purple-400 transition-colors">
                      {lesson.title}
                    </h3>
                    {isPassed && (
                      <div className="mt-3 inline-flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-lg text-xs font-bold">
                        <CheckCircle className="w-4 h-4" /> تم اجتياز الامتحان
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function QuizModal({ lesson, user, userData, onClose }: { lesson: Lesson, user: any, userData: any, onClose: () => void }) {
  const [timeLeft, setTimeLeft] = useState(lesson.duration * 60);
  const [answers, setAnswers] = useState<number[]>(Array(lesson.questions.length).fill(-1));
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ passed: boolean, score: number } | null>(null);

  useEffect(() => {
    if (timeLeft <= 0 && !submitted) {
      handleSubmit();
    }
    if (!submitted) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, submitted]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelect = (qIndex: number, optIndex: number) => {
    if (submitted) return;
    const newAns = [...answers];
    newAns[qIndex] = optIndex;
    setAnswers(newAns);
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    let score = 0;
    answers.forEach((ans, idx) => {
      if (ans === lesson.questions[idx].correctIndex) score++;
    });
    
    // Pass condition: >= 50%
    const passed = score >= Math.ceil(lesson.questions.length / 2);
    setResult({ passed, score });
    
    await setDoc(doc(db, 'progress', `${user.uid}_${lesson.id}`), {
      userId: user.uid,
      lessonId: lesson.id,
      status: passed ? 'Pass' : 'Fail',
      score,
      total: lesson.questions.length,
      timestamp: serverTimestamp()
    });

    if (!passed) {
      // Send WhatsApp Alert
      const parentPhone = userData?.parentPhone || '';
      if (parentPhone) {
        const msg = `تحذير من أكاديمية النخبة 🚨\nالطالب: ${userData?.name}\nرسب في امتحان "${lesson.title}"\nالدرجة: ${score}/${lesson.questions.length}\nيرجى المتابعة.`;
        // Format phone number (assuming Egypt format, remove leading 0 and add +20)
        let formattedPhone = parentPhone;
        if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone;
        
        const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
        // Open WhatsApp in a new tab
        window.open(waUrl, '_blank');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#131B2F] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#0B0F19] rounded-t-3xl">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">امتحان: {lesson.title}</h2>
            <p className="text-sm text-slate-400">أجب عن جميع الأسئلة قبل انتهاء الوقت</p>
          </div>
          {!submitted && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold ${timeLeft < 60 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-blue-500/20 text-blue-400'}`}>
              <Clock className="w-5 h-5" />
              {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {result ? (
            <div className="text-center py-12">
              {result.passed ? (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">مبروك! لقد اجتزت الامتحان</h3>
                  <p className="text-slate-300">الدرجة: {result.score} / {lesson.questions.length}</p>
                  <p className="text-emerald-400 font-medium mt-4">تم فتح المحاضرة بنجاح.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">للأسف، لم تجتز الامتحان</h3>
                  <p className="text-slate-300">الدرجة: {result.score} / {lesson.questions.length}</p>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mt-6 inline-block text-right">
                    <p className="text-red-400 font-medium flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" /> تم إرسال رسالة تحذيرية لولي الأمر عبر واتساب.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            lesson.questions.map((q, qIndex) => (
              <div key={qIndex} className="bg-[#0B0F19] border border-white/5 rounded-2xl p-6">
                <h4 className="text-lg font-bold text-white mb-4">{qIndex + 1}. {q.question}</h4>
                <div className="space-y-3">
                  {q.options.map((opt, optIndex) => (
                    <button
                      key={optIndex}
                      onClick={() => handleSelect(qIndex, optIndex)}
                      className={`w-full text-right px-4 py-3 rounded-xl border transition-all ${
                        answers[qIndex] === optIndex 
                          ? 'bg-purple-600/20 border-purple-500 text-white' 
                          : 'bg-[#131B2F] border-white/5 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-[#0B0F19] rounded-b-3xl flex justify-end gap-4">
          {result ? (
            <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-colors">
              إغلاق
            </button>
          ) : (
            <>
              <button onClick={onClose} className="text-slate-400 hover:text-white px-6 py-3 font-medium transition-colors">
                إلغاء
              </button>
              <button 
                onClick={handleSubmit}
                disabled={answers.includes(-1)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/25"
              >
                تسليم الإجابات
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: 'أهلاً بك! أنا المساعد الذكي الخاص بالمنصة. كيف يمكنني مساعدتك في المنهج اليوم؟' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  useEffect(() => {
    if (!chatRef.current) {
      chatRef.current = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: 'أنت مساعد ذكي لطلاب منصة تعليمية. أجب باللغة العربية بأسلوب احترافي، دقيق، ومبسط. ساعد الطلاب في فهم المواد العلمية.',
        }
      });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: response.text || 'عذراً، لم أتمكن من فهم ذلك.' }]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { role: 'model', text: 'حدث خطأ في الاتصال. يرجى المحاولة لاحقاً.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start">
      {isOpen && (
        <div className="bg-[#131B2F] rounded-3xl shadow-2xl shadow-purple-900/30 border border-white/10 w-[340px] sm:w-[380px] h-[500px] mb-4 flex flex-col overflow-hidden transition-all duration-300 origin-bottom-left">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">المساعد الذكي (AI)</h3>
                <p className="text-xs text-purple-100">متصل الآن</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0B0F19]/50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-purple-600 text-white rounded-br-none' 
                    : 'bg-[#1E293B] border border-white/5 text-slate-200 rounded-bl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-[#1E293B] border border-white/5 rounded-2xl rounded-bl-none p-4 flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-[#131B2F] border-t border-white/10">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                type="text" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="اسألني أي شيء..."
                className="flex-1 bg-[#0B0F19] border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white transition-all outline-none"
                dir="rtl"
              />
              <button 
                type="submit" disabled={!input.trim() || isTyping}
                className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shrink-0"
              >
                <Send className="w-5 h-5 mr-1" />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl shadow-2xl shadow-purple-900/50 flex items-center justify-center transition-all duration-300 hover:scale-105 border border-white/10 ${
          isOpen ? 'bg-[#131B2F] text-white' : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>
    </div>
  );
}
