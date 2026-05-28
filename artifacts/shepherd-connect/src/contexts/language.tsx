import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type LangCode = "en" | "yo" | "ig" | "ha" | "pcm";

export const LANGUAGES: Array<{ code: LangCode; label: string; nativeName: string; flag: string }> = [
  { code: "en",  label: "English",        nativeName: "English",    flag: "🇬🇧" },
  { code: "yo",  label: "Yoruba",         nativeName: "Yorùbá",     flag: "🇳🇬" },
  { code: "ig",  label: "Igbo",           nativeName: "Igbo",       flag: "🇳🇬" },
  { code: "ha",  label: "Hausa",          nativeName: "Hausa",      flag: "🇳🇬" },
  { code: "pcm", label: "Nigerian Pidgin", nativeName: "Naijá",     flag: "🇳🇬" },
];

export type Translations = {
  rccgFull: string;
  tagline: string;
  motto: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  enterBtn: string;
  opening: string;
  invalidLogin: string;
  newFamily: string;
  registerHere: string;
  footer: string;
  rolePills: { parent: string; teacher: string; admin: string; attendant: string };
  nav: {
    dashboard: string;
    families: string;
    children: string;
    classes: string;
    assignments: string;
    teachers: string;
    allocations: string;
    attendance: string;
    emergencies: string;
    auditLogs: string;
    users: string;
    myFamily: string;
    myChildren: string;
    delegates: string;
    feedback: string;
    myClass: string;
    appraisals: string;
    notifications: string;
    checkin: string;
    checkout: string;
    signOut: string;
  };
  welcomeBack: string;
  greeting: { morning: string; afternoon: string; evening: string };
  myChildren2: string;
  quickActions: string;
  showQR: string;
  report: string;
  inClass: string;
  unassigned: string;
};

const T: Record<LangCode, Translations> = {
  en: {
    rccgFull: "THE REDEEMED CHRISTIAN CHURCH OF GOD",
    tagline: "City of David — Victoria Island",
    motto: "Safe. Known. Celebrated.",
    emailPlaceholder: "Email address",
    passwordPlaceholder: "Password",
    enterBtn: "Enter the House",
    opening: "Opening doors...",
    invalidLogin: "Invalid email or password. Try again.",
    newFamily: "New family?",
    registerHere: "Register here",
    footer: "© 2026 Junior Church, City of David · Victoria Island",
    rolePills: { parent: "Parent", teacher: "Teacher", admin: "Admin", attendant: "Support" },
    nav: {
      dashboard: "Dashboard",
      families: "Families",
      children: "Children",
      classes: "Classes",
      assignments: "Assignments",
      teachers: "Teachers",
      allocations: "Allocations",
      attendance: "Attendance",
      emergencies: "Emergencies",
      auditLogs: "Audit Logs",
      users: "Users",
      myFamily: "My Family",
      myChildren: "My Children",
      delegates: "Delegates",
      feedback: "Feedback",
      myClass: "My Class",
      appraisals: "Appraisals",
      notifications: "Notifications",
      checkin: "Check-in",
      checkout: "Check-out",
      signOut: "Sign Out",
    },
    welcomeBack: "Welcome back,",
    greeting: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
    myChildren2: "My Children",
    quickActions: "Quick Actions",
    showQR: "Show QR",
    report: "Report",
    inClass: "In Class",
    unassigned: "Unassigned",
  },

  yo: {
    rccgFull: "ÌJỌ KRISTẸNI TÍ A TÚN BÍ SÍNÚ OLÚWA",
    tagline: "Ìlú Dáfídì — Victoria Island",
    motto: "Ailewu. Mọ. Yìn.",
    emailPlaceholder: "Àdírẹ́sì ìmèélì",
    passwordPlaceholder: "Ọ̀rọ̀ àṣírí",
    enterBtn: "Wọ Ilé Ìjọ",
    opening: "Ṣíṣí ẹnu-ọ̀nà...",
    invalidLogin: "Ìmèélì tàbí ọ̀rọ̀ àṣírí kò tọ́. Gbìyànjú.",
    newFamily: "Ìdílé tuntun?",
    registerHere: "Forúkọsilẹ níbí",
    footer: "© 2026 Ìjọ Ọmọ, Ìlú Dáfídì · Victoria Island",
    rolePills: { parent: "Òbí", teacher: "Olùkọ́", admin: "Alákòóso", attendant: "Olùránlọ́wọ́" },
    nav: {
      dashboard: "Iṣakoso",
      families: "Àwọn Ìdílé",
      children: "Àwọn Ọmọ",
      classes: "Àwọn Ìkẹ́kọ̀ọ́",
      assignments: "Àwọn Ìṣẹ́",
      teachers: "Àwọn Olùkọ́",
      allocations: "Ìpínrọlẹ",
      attendance: "Ìwọ̀ Sínú",
      emergencies: "Pàjáwìrì",
      auditLogs: "Àkọsílẹ̀",
      users: "Àwọn Olùmúlò",
      myFamily: "Ìdílé Mi",
      myChildren: "Àwọn Ọmọ Mi",
      delegates: "Àwọn Aṣojú",
      feedback: "Ìdáhùn",
      myClass: "Ìkẹ́kọ̀ọ́ Mi",
      appraisals: "Ìfojúsùn",
      notifications: "Ìwíilétí",
      checkin: "Wọlé",
      checkout: "Jáde",
      signOut: "Jáde Kúrò",
    },
    welcomeBack: "Ẹ káàbọ̀,",
    greeting: { morning: "Ẹ káàárọ̀", afternoon: "Ẹ káàsán", evening: "Ẹ kaálẹ̀" },
    myChildren2: "Àwọn Ọmọ Mi",
    quickActions: "Ìgbésẹ̀ Kíákíá",
    showQR: "Ṣe àfihàn QR",
    report: "Ìjábọ̀",
    inClass: "Nínú Ìkẹ́kọ̀ọ́",
    unassigned: "Kò sí Ìkẹ́kọ̀ọ́",
  },

  ig: {
    rccgFull: "ỤLỌ CHUKWU NDỊ KRAỊST NỌ N'ỤZỌ NZỌPỤTA",
    tagline: "Obodo Devid — Victoria Island",
    motto: "Nchedo. Ama ama. Ememe.",
    emailPlaceholder: "Adreesị email",
    passwordPlaceholder: "Okwuntughe",
    enterBtn: "Banye n'ụlọ",
    opening: "Na emeghe ụzọ...",
    invalidLogin: "Email ma ọ bụ okwuntughe adịghị mma. Nwaa ọzọ.",
    newFamily: "Ezinụlọ ọhụrụ?",
    registerHere: "Debanye aha ebe a",
    footer: "© 2026 Ụlọ Ọzụzụ Ụmụaka, Obodo Devid · Victoria Island",
    rolePills: { parent: "Nne/Nna", teacher: "Nkuzi", admin: "Njikwa", attendant: "Onye enyemaka" },
    nav: {
      dashboard: "Njikwa",
      families: "Ezinụlọ",
      children: "Ụmụaka",
      classes: "Klaasị",
      assignments: "Ọrụ",
      teachers: "Ndị nkuzi",
      allocations: "Nkesa",
      attendance: "Ọnụọgụ",
      emergencies: "Ihe mberede",
      auditLogs: "Ndekọ",
      users: "Ndị ọrụ",
      myFamily: "Ezinụlọ m",
      myChildren: "Ụmụ m",
      delegates: "Ndị nnọchiteanya",
      feedback: "Nzaghachi",
      myClass: "Klaasị m",
      appraisals: "Nyocha",
      notifications: "Ọkwa",
      checkin: "Banye",
      checkout: "Pụọ",
      signOut: "Pụọ n'ime",
    },
    welcomeBack: "Nnọọ,",
    greeting: { morning: "Ụtụtụ ọma", afternoon: "Ehihie ọma", evening: "Anyasị ọma" },
    myChildren2: "Ụmụ m",
    quickActions: "Omume ngwa ngwa",
    showQR: "Ọkwa QR",
    report: "Ọkọwa",
    inClass: "N'ime klaasị",
    unassigned: "Enweghị klaasị",
  },

  ha: {
    rccgFull: "COCIN KIRISTANCI TA ALLAH TA FANSAR MUTANE",
    tagline: "Birnin Dawuda — Victoria Island",
    motto: "Aminci. An san ku. Bukukuwa.",
    emailPlaceholder: "Adireshin imel",
    passwordPlaceholder: "Kalmar sirri",
    enterBtn: "Shiga Gida",
    opening: "Yana buɗe ƙofa...",
    invalidLogin: "Imel ko kalmar sirri ba daidai ba. Sake gwadawa.",
    newFamily: "Iyali sabo?",
    registerHere: "Yi rajista nan",
    footer: "© 2026 Cocin Yara, Birnin Dawuda · Victoria Island",
    rolePills: { parent: "Iyaye", teacher: "Malamai", admin: "Mai kula", attendant: "Mai taimako" },
    nav: {
      dashboard: "Allon sarrafa",
      families: "Iyalai",
      children: "Yara",
      classes: "Azuzuwa",
      assignments: "Ayyuka",
      teachers: "Malamai",
      allocations: "Rarrabawa",
      attendance: "Halartar",
      emergencies: "Gaggawa",
      auditLogs: "Tarihin bincike",
      users: "Masu amfani",
      myFamily: "Iyalina",
      myChildren: "Yarana",
      delegates: "Wakilai",
      feedback: "Ra'ayi",
      myClass: "Ajujuwana",
      appraisals: "Kimantawa",
      notifications: "Sanarwa",
      checkin: "Shigowa",
      checkout: "Fita",
      signOut: "Fita",
    },
    welcomeBack: "Maraba da komowa,",
    greeting: { morning: "Ina kwana", afternoon: "Ina yini", evening: "Barka da yamma" },
    myChildren2: "Yarana",
    quickActions: "Ayyukan gaggawa",
    showQR: "Nuna QR",
    report: "Rahoto",
    inClass: "A cikin ajali",
    unassigned: "Ba a sanya ba",
  },

  pcm: {
    rccgFull: "DI RIDIEMED CHRISTIAN CHURCH OF GOD",
    tagline: "City of David — Victoria Island",
    motto: "Safe. Dem sabi you. Dem celebrate you.",
    emailPlaceholder: "Your email address",
    passwordPlaceholder: "Your password",
    enterBtn: "Enter di House",
    opening: "Dem dey open door...",
    invalidLogin: "Email or password no correct. Try again abeg.",
    newFamily: "New family?",
    registerHere: "Register here",
    footer: "© 2026 Junior Church, City of David · Victoria Island",
    rolePills: { parent: "Papa/Mama", teacher: "Teacher", admin: "Admin", attendant: "Support" },
    nav: {
      dashboard: "Dashboard",
      families: "Families",
      children: "Pikin dem",
      classes: "Classes",
      assignments: "Assignments",
      teachers: "Teachers",
      allocations: "Allocations",
      attendance: "Attendance",
      emergencies: "Emergency",
      auditLogs: "Audit Logs",
      users: "Users",
      myFamily: "My Family",
      myChildren: "My Pikin dem",
      delegates: "Delegates",
      feedback: "Feedback",
      myClass: "My Class",
      appraisals: "Appraisals",
      notifications: "Notifications",
      checkin: "Check-in",
      checkout: "Check-out",
      signOut: "Sign Out",
    },
    welcomeBack: "Welcome back,",
    greeting: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
    myChildren2: "My Pikin dem",
    quickActions: "Quick Actions",
    showQR: "Show QR",
    report: "Report",
    inClass: "Dey for Class",
    unassigned: "No Class yet",
  },
};

type LanguageContextType = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: Translations;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: T.en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => {
    return (localStorage.getItem("shepherd-lang") as LangCode) || "en";
  });

  const setLang = (l: LangCode) => {
    setLangState(l);
    localStorage.setItem("shepherd-lang", l);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: T[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
