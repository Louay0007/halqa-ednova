import type { Lang } from './api';

export const STRINGS: Record<string, Record<Lang, string>> = {
  peers_first: {
    en: 'Peers answer first — Nova prepares quietly',
    fr: 'Les pairs d’abord — Nova prépare en silence',
    ar: 'الزملاء أولاً — Nova تحضّر بصمت',
    darija: 'الزملاء هوما لولين — Nova تحضّر في صمت',
  },
  skip: { en: 'Skip the wait', fr: 'Passer l’attente', ar: 'تخطَّ الانتظار', darija: 'فوّت الاستنا' },
  ask_circle: { en: 'Ask the circle', fr: 'Demande au cercle', ar: 'اسأل الحلقة', darija: 'سقسا الحلقة' },
  simplified: {
    en: 'Simplified answer (quota)',
    fr: 'Réponse simplifiée (quota)',
    ar: 'إجابة مبسطة (الحصة)',
    darija: 'إجابة مختصرة (الكوطا)',
  },
  offline_mode: {
    en: 'Offline — circle tools still work',
    fr: 'Hors ligne — les outils du cercle marchent',
    ar: 'دون اتصال — أدوات الحلقة تعمل',
    darija: 'بلا connexion — أدوات الحلقة تخدم',
  },
  ai_sleeps: {
    en: 'Even when the AI sleeps, the circle keeps learning',
    fr: 'Même quand l’IA dort, le cercle continue d’apprendre',
    ar: 'حتى عندما تنام الـAI، تواصل الحلقة التعلم',
    darija: 'حتى كي الـAI ترقد، الحلقة تكمّل تتعلّم',
  },
  asker_only: {
    en: 'Only the asker can take hints',
    fr: 'Seul celui qui pose la question peut demander des indices',
    ar: 'صاحب السؤال وحده يمكنه طلب التلميحات',
    darija: 'غير اللي سقسا ينجم يطلب الـhints',
  },
  l4_locked: {
    en: 'Answer unlocks after hints 1–3',
    fr: 'La réponse vient après les indices 1–3',
    ar: 'الإجابة بعد التلميحات 1–3',
    darija: 'الإجابة تجي بعد الـhints 1–3',
  },
  ask: { en: 'Ask', fr: 'Demander', ar: 'اسأل', darija: 'اسأل' },
  i_can_help: { en: 'I can help', fr: 'Je peux aider', ar: 'أقدر نعاون', darija: 'ننجم نعاون' },
  me_too: { en: 'Me too', fr: 'Moi aussi', ar: 'أنا أيضاً', darija: 'أنا زادة' },
  nova_thinking: { en: 'Nova is thinking…', fr: 'Nova réfléchit…', ar: 'Nova يفكّر…', darija: 'Nova يخمم…' },
  verified: { en: 'verified by Nova', fr: 'vérifié par Nova', ar: 'تحققت منه Nova', darija: 'تأكدت منو Nova' },
  retry: { en: 'Retry', fr: 'Réessayer', ar: 'حاول مجدداً', darija: 'عاود حاول' },

  // §6.7 — shell systems (spec §3)
  setup_hint: {
    en: 'Backend not reachable',
    fr: 'Backend injoignable',
    ar: 'الـBackend غير متاح',
    darija: 'الـBackend ما يخدمش',
  },
  setup_hint_body: {
    en: 'Start the API, then reload this page.',
    fr: 'Lance l’API, puis recharge cette page.',
    ar: 'شغّل الـAPI ثم أعد تحميل الصفحة.',
    darija: 'شغّل الـAPI وبعد reload الصفحة.',
  },
  setup_hint_cmd: { en: 'cd halqa-api && npm run start:dev', fr: 'cd halqa-api && npm run start:dev', ar: 'cd halqa-api && npm run start:dev', darija: 'cd halqa-api && npm run start:dev' },
  open_passport: { en: 'Open passport', fr: 'Ouvrir le passeport', ar: 'افتح الجواز', darija: 'حلّ الجواز' },
  close: { en: 'Close', fr: 'Fermer', ar: 'أغلق', darija: 'سدّ' },
  copy_code: { en: 'Copy circle code', fr: 'Copier le code', ar: 'انسخ رمز الحلقة', darija: 'انسخ الرمز' },
  copied: { en: 'Copied ✓', fr: 'Copié ✓', ar: 'تنسخ ✓', darija: 'تنسخ ✓' },
  qr_circle: { en: 'Scan to join this circle', fr: 'Scanne pour rejoindre', ar: 'امسح للانضمام', darija: 'امسح باش تدخل' },
  nav_circle: { en: 'Circle', fr: 'Cercle', ar: 'الحلقة', darija: 'الحلقة' },
  nav_circles: { en: 'Circles', fr: 'Cercles', ar: 'الحلقات', darija: 'الحلقات' },
  nav_passport: { en: 'Passport', fr: 'Passeport', ar: 'الجواز', darija: 'الجواز' },
  nav_board: { en: 'Board', fr: 'Tableau', ar: 'اللوحة', darija: 'اللوحة' },
  nav_lab: { en: 'Lab', fr: 'Labo', ar: 'المختبر', darija: 'اللابو' },
  quota_out: {
    en: 'Quota out — simplified answers only',
    fr: 'Quota épuisé — réponses simplifiées',
    ar: 'انتهت الحصة — إجابات مبسطة فقط',
    darija: 'وفات الكوطا — إجابات مختصرة برك',
  },
  pw_current: { en: 'Current passphrase', fr: 'Phrase actuelle', ar: 'العبارة الحالية', darija: 'العبارة الحالية' },
  pw_new: { en: 'New passphrase', fr: 'Nouvelle phrase', ar: 'عبارة جديدة', darija: 'عبارة جديدة' },
  pw_update: { en: 'Update passphrase', fr: 'Mettre à jour', ar: 'حدّث العبارة', darija: 'بدّل العبارة' },
  pw_hint: {
    en: '8 characters minimum — signs other devices out.',
    fr: '8 caractères min. — déconnecte les autres appareils.',
    ar: '8 أحرف على الأقل — يخرج الأجهزة الأخرى.',
    darija: '8 حروف على الأقل — يخرّج الأجهزة الأخرى.',
  },
  guest_upgrade: {
    en: 'Guest record — claim an account on /enter to keep your passport.',
    fr: 'Compte invité — réclamez un compte sur /enter pour garder votre passeport.',
    ar: 'سجل ضيف — أنشئ حساباً من /enter لتحفظ جوازك.',
    darija: 'سيزيون ضيف — أصنع حساب من /enter باش تحفظ الجواز.',
  },
  sign_out: { en: 'Sign out', fr: 'Déconnexion', ar: 'خروج', darija: 'خرج' },
  skip_content: { en: 'Skip to content', fr: 'Aller au contenu', ar: 'تجاوز إلى المحتوى', darija: 'تجاوز للمحتوى' },


  // §6 — parity sweep (P6)
  me_lede: { en: 'Your learner record on this device.', fr: 'Votre dossier d’apprenant sur cet appareil.', ar: 'سجلك كمتعلّم على هذا الجهاز.', darija: 'سجلك كمتعلّم على هاد الجهاز.' },
  no_passport: { en: 'No passport yet — run the DNA.', fr: 'Pas encore de passeport — faites le diagnostic.', ar: 'لا يوجد جواز بعد — أجرِ التشخيص.', darija: 'ما فماش جواز بعد — دير التشخيص.' },
  cached: { en: 'cached', fr: 'en cache', ar: 'مخزّن', darija: 'مخزّن' },
  offline_tag: { en: 'offline', fr: 'hors ligne', ar: 'دون اتصال', darija: 'بلا اتصال' },
  no_cites: { en: 'no cites — file it', fr: 'aucune source — à signaler', ar: 'لا مصادر — أبلغ عنها', darija: 'ما فماش مصادر — علام عليها' },

  // §4 R1 — /enter parity (P6)
  enter_step_title: { en: 'Step in quietly', fr: 'Entrez discrètement', ar: 'ادخل بهدوء', darija: 'ادخل بهدوء' },
  enter_claim_title: { en: 'Claim your seat', fr: 'Prenez votre place', ar: 'احجز مكانك', darija: 'احجز بلاصتك' },
  enter_welcome_title: { en: 'Welcome back', fr: 'Bon retour', ar: 'مرحباً بعودتك', darija: 'مرحبا بعودتك' },
  enter_guest_sub: { en: 'A nickname, nothing more. Claim an account later from your passport.', fr: 'Un surnom, rien de plus. Prenez un compte plus tard depuis votre passeport.', ar: 'اسم مستعار فقط. يمكنك إنشاء حساب لاحقاً من جوازك.', darija: 'سمية مستعارة برك. تنجم تصنع حساب من بعد من جوازك.' },
  enter_signup_sub: { en: 'A pseudonym and a passphrase. No email, nothing personal.', fr: 'Un pseudonyme et une phrase secrète. Pas d’email, rien de personnel.', ar: 'اسم مستعار وعبارة سرية. لا بريد إلكتروني، لا بيانات شخصية.', darija: 'سمية مستعارة وكلمة سر. لا ايميل، لا بيانات شخصية.' },
  enter_signin_sub: { en: 'Sign back in from any device.', fr: 'Reconnectez-vous depuis n’importe quel appareil.', ar: 'سجّل الدخول من أي جهاز.', darija: 'دخل من أي جهاز.' },
  enter_nick: { en: 'Nickname', fr: 'Surnom', ar: 'الاسم المستعار', darija: 'السمية' },
  enter_pseudonym: { en: 'Pseudonym', fr: 'Pseudonyme', ar: 'اسم مستعار', darija: 'اسم مستعار' },
  enter_handle_hint: { en: 'Lowercase, how peers find you.', fr: 'En minuscules, pour que les pairs vous trouvent.', ar: 'بحروف صغيرة، ليج الأخوة يلقاوك.', darija: 'بحروف صغيرة، باش الزملاء يلقاوك.' },
  enter_passphrase: { en: 'Passphrase', fr: 'Phrase secrète', ar: 'العبارة السرية', darija: 'كلمة السر' },
  enter_hide: { en: 'Hide', fr: 'Masquer', ar: 'إخفاء', darija: 'خفي' },
  enter_show: { en: 'Show', fr: 'Afficher', ar: 'إظهار', darija: 'وري' },
  enter_avatar: { en: 'Avatar', fr: 'Avatar', ar: 'الصورة الرمزية', darija: 'الصورة' },
  enter_context: { en: 'Where will you learn?', fr: 'Où allez-vous apprendre ?', ar: 'أين ستتعلّم؟', darija: 'فين غتعلّم؟' },
  enter_busy_guest: { en: 'Stepping in…', fr: 'Entrée…', ar: 'جارٍ الدخول…', darija: 'جارٍ الدخول…' },
  enter_busy_signup: { en: 'Claiming…', fr: 'Création…', ar: 'جارٍ الإنشاء…', darija: 'جارٍ الإنشاء…' },
  enter_busy_signin: { en: 'Signing in…', fr: 'Connexion…', ar: 'جارٍ تسجيل الدخول…', darija: 'جارٍ تسجيل الدخول…' },
  enter_guest_cta: { en: 'Continue as guest', fr: 'Continuer comme invité', ar: 'المتابعة كضيف', darija: 'كمّل كضيف' },
  enter_signin_cta: { en: 'Sign in', fr: 'Se connecter', ar: 'تسجيل الدخول', darija: 'دخل' },
  enter_signup_cta: { en: 'Create account', fr: 'Créer un compte', ar: 'إنشاء حساب', darija: 'أصنع حساب' },
  enter_guest_cta_short: { en: 'Try it', fr: 'Essayer', ar: 'جرّب', darija: 'جرّب' },
  enter_foot_signup: { en: 'Just a pseudonym and a passphrase.', fr: 'Juste un pseudonyme et une phrase secrète.', ar: 'مجرد اسم مستعار وعبارة سرية.', darija: 'غير سمية مستعارة وكلمة سر.' },
  enter_foot_other: { en: 'Accounts stay pseudonymous by design.', fr: 'Les comptes restent pseudonymes par conception.', ar: 'الحسابات تبقى مجهولة الهوية بالتصميم.', darija: 'الحسابات كتبقى مجهولة بالتصميم.' },
  have_code_short: { en: 'Have a join code?', fr: 'Vous avez un code ?', ar: 'لديك رمز انضمام؟', darija: 'عندك رمز؟' },
  enter_min_chars: { en: '{n} characters minimum.', fr: '{n} caractères minimum.', ar: '{n} أحرف على الأقل.', darija: '{n} حروف على الأقل.' },
  enter_pw_long: { en: '{n} characters maximum.', fr: '{n} caractères maximum.', ar: '{n} حرفاً كحدّ أقصى.', darija: '{n} حرف كأقصى حد.' },
  enter_handle_bad: { en: 'Use 3–20 letters, numbers, - or _', fr: '3 à 20 lettres, chiffres, - ou _', ar: 'استعمل 3–20 حرفاً أو رقماً أو - أو _', darija: 'استعمل 3–20 حرف ولا رقم ولا - ولا _' },
  enter_no_email: { en: 'No email. No phone.', fr: 'Pas d’email. Pas de téléphone.', ar: 'لا بريد. لا هاتف.', darija: 'لا ايميل. لا تيليفون.' },
  enter_failed: { en: 'Could not continue — try again.', fr: 'Impossible de continuer — réessayez.', ar: 'تعذّر المتابعة — حاول مجدداً.', darija: 'ما قدرناش نكملو — عاود حاول.' },
  enter_tabs_label: { en: 'Create an account, sign in, or try as a guest', fr: 'Créer un compte, se connecter, ou essayer en invité', ar: 'أنشئ حساباً، سجّل الدخول، أو جرّب كضيف', darija: 'أصنع حساب، دخل، ولا جرّب كضيف' },
  enter_ctx_study: { en: 'Study', fr: 'Étude', ar: 'دراسة', darija: 'دراسة' },
  enter_ctx_study_d: { en: 'Revision circle with friends', fr: 'Cercle de révision entre amis', ar: 'حلقة مراجعة مع الأصدقاء', darija: 'حلقة مراجعة مع الصحاب' },
  enter_ctx_class: { en: 'Class', fr: 'Classe', ar: 'القسم', darija: 'القسم' },
  enter_ctx_class_d: { en: 'Teacher-led lesson', fr: 'Cours dirigé par le professeur', ar: 'درس بقيادة المعلّم', darija: 'درس بقيادة الأستاذ' },
  enter_ctx_workshop: { en: 'Workshop', fr: 'Atelier', ar: 'ورشة', darija: 'ورشة' },
  enter_ctx_workshop_d: { en: 'Matched groups + mentor board', fr: 'Groupes appariés + tableau mentor', ar: 'مجموعات متوافقة + لوحة المرشد', darija: 'مجموعات متوافقة + لوحة المرشد' },
  enter_ctx_community: { en: 'Community', fr: 'Communauté', ar: 'مجتمع', darija: 'مجتمع' },
  enter_ctx_community_d: { en: 'Low-bandwidth friendly', fr: 'Adapté aux connexions lentes', ar: 'مناسب للاتصال الضعيف', darija: 'مناسب للكونكسيون الضعيفة' },
  enter_ctx_program: { en: 'Program', fr: 'Programme', ar: 'برنامج', darija: 'برنامج' },
  enter_ctx_program_d: { en: 'Repeated sessions, spaced review', fr: 'Séances répétées, révision espacée', ar: 'جلسات متكررة ومراجعة متباعدة', darija: 'جلسات متكررة ومراجعة متباعدة' },
  enter_ctx_solo: { en: 'Solo', fr: 'Solo', ar: 'منفرد', darija: 'منفرد' },
  enter_ctx_solo_d: { en: 'Just you + Nova', fr: 'Juste vous + Nova', ar: 'أنت وNova فقط', darija: 'غير نتا وNova' },
  // §4 R2 — diagnostic / live passport
  dna_title: { en: 'Diagnose — 4 taps, 3 minutes', fr: 'Diagnostique — 4 tapes, 3 minutes', ar: 'تشخيص — 4 ضغطات، 3 دقائق', darija: 'تشخيص — 4 ضغوط، 3 دقيقة' },
  dna_sub: { en: 'Four questions. Your learner passport fills itself live.', fr: 'Quatre questions. Votre passeport se remplit en direct.', ar: 'أربعة أسئلة. جوازك يملأ نفسه مباشرة.', darija: '4 أسئلة. جوازك كيملا هو نفسه مباشرة.' },
  dna_load: { en: 'Could not load the diagnostic.', fr: 'Impossible de charger le diagnostic.', ar: 'تعذّر تحميل التشخيص.', darija: 'ما صلّحتش تحميل التشخيص.' },
  dna_failed: { en: 'Diagnostic failed — retry.', fr: 'Diagnostic impossible — réessayer.', ar: 'فشل التشخيص — حاول مجدداً.', darija: 'فشل التشخيص — عاود حاول.' },
  dna_saving: { en: 'Saving…', fr: 'Enregistrement…', ar: 'جارٍ الحفظ…', darija: 'جارٍ الحفظ…' },
  dna_submit: { en: 'See my passport →', fr: 'Voir mon passeport →', ar: 'شوف جوازي →', darija: 'شوف جوازي →' },
  dna_ready: { en: 'Passport ready ✓', fr: 'Passeport prêt ✓', ar: 'الجواز جاهز ✓', darija: 'الجواز جاهز ✓' },
  dna_progress: { en: 'Tap to fill · {n} of 4', fr: 'Touchez pour remplir · {n} sur 4', ar: 'اضغط باش تملي · {n} من 4', darija: 'اضغط باش تملي · {n} من 4' },
  passport_live: { en: 'Learner Passport', fr: 'Passeport de l’apprenant', ar: 'جواز المتعلّم', darija: 'جواز المتعلّم' },
  passport_level: { en: 'Level', fr: 'Niveau', ar: 'المستوى', darija: 'المستوى' },
  passport_style: { en: 'Style', fr: 'Style', ar: 'الأسلوب', darija: 'الأسلوب' },
  passport_lang: { en: 'Language', fr: 'Langue', ar: 'اللغة', darija: 'اللغة' },
  passport_hints: { en: 'Hints', fr: 'Indices', ar: 'التلميحات', darija: 'التلميحات' },
  passport_invite: { en: 'Invite me', fr: 'Invitez-moi', ar: 'ادعني', darija: 'ادعني' },
  dna_hint_eager: { en: 'eager', fr: 'avide', ar: 'جاهز', darija: 'كيعرف' },
  dna_hint_normal: { en: 'normal', fr: 'normal', ar: 'عادي', darija: 'عادي' },
  dna_hint_light: { en: 'light', fr: 'léger', ar: 'خفيف', darija: 'خفيف' },
  solo_title: { en: 'Teach Nova — solo', fr: 'Enseigne Nova — solo', ar: 'عَلّم Nova — منفرد', darija: 'عَلّم Nova — منفرد' },
  solo_start: { en: 'Start — Nova is the curious student', fr: 'Commencer — Nova est l’élève curieux', ar: 'ابدأ — Nova الطالب الفضولي', darija: 'ابدأ — Nova الطالب الفضولي' },
  solo_start_copy: { en: 'One learner, one hat, eight turns. Nova asks, you teach.', fr: 'Un apprenant, un chapeau, huit tours. Nova questionne, vous enseignez.', ar: 'متعلّم واحد، غطاء واحد، ثماني جولات. Nova تسأل، وأنت تدرّس.', darija: 'متعلّم واحد، غطاء واحد، 8 جولات. Nova تسول، وأنت كتعليم.' },
  solo_enter: { en: 'Enter first, then come back →', fr: 'Entrez d’abord, puis revenez →', ar: 'ادخل أولاً، ثم عد →', darija: 'ادخل الأول، وبعداد →' },
  solo_progress: { en: 'Teach Nova {n} of {m} turns', fr: 'Enseigne Nova {n} de {m} tours', ar: 'عَلّم Nova {n} من {m} الجولات', darija: 'عَلّم Nova {n} من {m} الجولات' },
  solo_teacher: { en: 'Answer as the teacher — Nova learns from you.', fr: 'Réponds comme l’enseignant — Nova apprend de toi.', ar: 'أجب كالمعلم — Nova يتعلّم منك.', darija: 'أجب كالأستاذ — Nova كيتعلّم منك.' },
  solo_send: { en: 'Your explanation', fr: 'Votre explication', ar: 'شرحك', darija: 'شرحك' },
  solo_send_short: { en: 'Send', fr: 'Envoyer', ar: 'أرسل', darija: 'أرسل' },
  solo_budget: { en: 'Solo budget: {n} turns used', fr: 'Budget solo : {n} tours passés', ar: 'الميزانية المنفردة: {n} جولة', darija: 'ميزانية المنفرد: {n} جولة' },
  solo_invite: { en: 'Invite a friend — make it a circle', fr: 'Invite un ami — transforme ça en cercle', ar: 'ادعُ صديقاً — حوّل ذلك إلى حلقة', darija: 'ادع صاحب — حوّل هاك إلى حلقة' },
  solo_qr: { en: 'Invite QR', fr: 'QR d’invitation', ar: 'رمز النداء', darija: 'رمز الدعوة' },
  solo_code: { en: 'code', fr: 'code', ar: 'الرمز', darija: 'الرمز' },
  dna_invited: { en: 'Invited', fr: 'Invité', ar: 'مُدعو', darija: 'مدعو' },


  // §4 R4–R6 — create / join / lobby
  circle_ready: { en: 'Circle ready — share the code', fr: 'Cercle prêt — partagez le code', ar: 'الحلقة جاهزة — شارك الرمز', darija: 'الحلقة جاهزة — شارك الرمز' },
  share_hint: { en: 'Peers: camera → scan the QR, or type the code.', fr: 'Pairs : caméra → scannez le QR, ou tapez le code.', ar: 'الزملاء: كاميرا → امسح الـQR، أو اكتب الرمز.', darija: 'الزملاء: كاميرا → امسح الـQR، ولا اكتب الرمز.' },
  result_qr: { en: 'Join QR', fr: 'QR de participation', ar: 'رمز الانضمام', darija: 'رمز الدخول' },
  code_copy: { en: 'Copy code', fr: 'Copier le code', ar: 'انسخ الرمز', darija: 'انسخ الرمز' },
  open_lobby: { en: 'Open lobby →', fr: 'Ouvrir le cercle →', ar: 'افتح الحلقة →', darija: 'حلّ الحلقة →' },
  new_circle: { en: 'New circle', fr: 'Nouveau cercle', ar: 'حلقة جديدة', darija: 'حلقة جديدة' },
  new_circle_sub: { en: 'Under a minute. Your code, your circle.', fr: 'En moins d’une minute. Votre code, votre cercle.', ar: 'أقل من دقيقة. رمزك، حلقتك.', darija: 'أقل من دقيقة. الرمز متاعك، والحلقة متاعك.' },
  topic: { en: 'Topic', fr: 'Sujet', ar: 'الموضوع', darija: 'الموضوع' },
  chunks: { en: 'chunks', fr: 'morceaux', ar: 'مقاطع', darija: 'مقاطع' },
  context: { en: 'Context', fr: 'Contexte', ar: 'السياق', darija: 'السياق' },
  circle_lang: { en: 'Circle language', fr: 'Langue du cercle', ar: 'لغة الحلقة', darija: 'لغة الحلقة' },
  peer_window: { en: 'Peer window', fr: 'Fenêtre des pairs', ar: 'نافذة الزملاء', darija: 'وقت الزملاء' },
  peer_window_hint: { en: 'Peers answer for this long before Nova steps in.', fr: 'Les pairs répondent pendant ce temps avant Nova.', ar: 'الزملاء يجيبون هذه المدة قبل Nova.', darija: 'الزملاء يجاوبو هاد المدة قبل Nova.' },
  agenda_preview: { en: 'Agenda preview', fr: 'Aperçu du déroulé', ar: 'معاينة الأجندة', darija: 'معاينة الأجندة' },
  your_nick: { en: 'Your nickname', fr: 'Votre surnom', ar: 'اسمك المستعار', darija: 'سميتك المستعارة' },
  create_circle: { en: 'Create circle →', fr: 'Créer le cercle →', ar: 'أنشئ الحلقة →', darija: 'أصنع الحلقة →' },
  have_code: { en: 'Have a code? Join instead →', fr: 'Vous avez un code ? Rejoignez →', ar: 'لديك رمز؟ انضم →', darija: 'عندك رمز؟ انضم →' },
  join_circle: { en: 'Join a circle', fr: 'Rejoindre un cercle', ar: 'انضم إلى حلقة', darija: 'انضم لحلقة' },
  join_sub: { en: 'Scan the QR or type the six-letter code.', fr: 'Scannez le QR ou tapez le code à six lettres.', ar: 'امسح الـQR أو اكتب الرمز المكوّن من 6 أحرف.', darija: 'امسح الـQR ولا اكتب الرمز متاع 6 حروف.' },
  code_label: { en: 'Circle code', fr: 'Code du cercle', ar: 'رمز الحلقة', darija: 'رمز الحلقة' },
  check_code: { en: 'Check', fr: 'Vérifier', ar: 'تحقّق', darija: 'شوف' },
  joining: { en: 'Joining…', fr: 'Connexion…', ar: 'جارٍ الانضمام…', darija: 'جارٍ الدخول…' },
  join_arrow: { en: 'Join →', fr: 'Rejoindre →', ar: 'انضم →', darija: 'انضم →' },
  host: { en: 'Host', fr: 'Hôte', ar: 'المضيف', darija: 'المضيف' },
  waiting_host: { en: 'Waiting for the host to start…', fr: 'En attente du démarrage par l’hôte…', ar: 'بانتظار بدء المضيف…', darija: 'كنتسناو المضيف يبدأ…' },
  start_session: { en: 'Start session →', fr: 'Démarrer la séance →', ar: 'ابدأ الجلسة →', darija: 'ابدأ الجلسة →' },


  // §4 R9–R12 — pro screens + lab (P5)
  board_title: { en: 'Workshop board', fr: 'Tableau de l’atelier', ar: 'لوحة الورشة', darija: 'لوحة الورشة' },
  board_sub: { en: 'Matcher + live circle health. Every score has a screen.', fr: 'Appariement + santé des cercles en direct.', ar: 'المطابقة + صحة الحلقة مباشرة. كل معيار له شاشة.', darija: 'المطابقة + صحة الحلقة مباشرة. كل معيار عندو شاشة.' },
  matcher_label: { en: 'Nicknames (one per line) → matched circles of 3–5', fr: 'Surnoms (un par ligne) → cercles de 3 à 5', ar: 'الأسماء المستعارة (واحد في السطر) → حلقات من 3 إلى 5', darija: 'الأسماء المستعارة (واحد في السطر) → حلقات من 3 لـ 5' },
  match_btn: { en: 'Match circles', fr: 'Former les cercles', ar: 'كوّن الحلقات', darija: 'كوّن الحلقات' },
  circles: { en: 'Circles', fr: 'Cercles', ar: 'الحلقات', darija: 'الحلقات' },
  no_session: { en: 'no session yet', fr: 'pas encore de séance', ar: 'لا توجد جلسة بعد', darija: 'ما فماش جلسة بعد' },
  needs_human_now: { en: 'Needs a human now', fr: 'Besoin d’un humain', ar: 'يحتاج إنساناً الآن', darija: 'لازم واحد بشري دابا' },
  no_circles: { en: 'No circles yet.', fr: 'Aucun cercle pour l’instant.', ar: 'لا توجد حلقات بعد.', darija: 'ما فماش حلقات بعد.' },
  mentor_title: { en: 'Mentor seat', fr: 'Siège du mentor', ar: 'مقعد المرشد', darija: 'كرسي المرشد' },
  mentor_invisible: { en: 'You are invisible — no credits, no turns.', fr: 'Vous êtes invisible — aucun crédit, aucun tour.', ar: 'أنت غير مرئي — لا أرصدة، لا أدوار.', darija: 'أنت غير مرئي — لا أرصدة، لا أدوار.' },
  mentor_join: { en: 'Join as observer', fr: 'Rejoindre comme observateur', ar: 'انضم كمراقب', darija: 'انضم كمراقب' },
  mentor_brief: { en: 'Brief (≤60 words)', fr: 'Brief (≤60 mots)', ar: 'ملخص (≤60 كلمة)', darija: 'ملخص (≤60 كلمة)' },
  mentor_load: { en: 'Load brief', fr: 'Charger le brief', ar: 'حمّل الملخص', darija: 'حمّل الملخص' },
  words: { en: 'words', fr: 'mots', ar: 'كلمات', darija: 'كلمات' },
  mentor_note_label: { en: 'Gentle note (≤500)', fr: 'Note douce (≤500)', ar: 'ملاحظة لطيفة (≤500)', darija: 'ملاحظة لطيفة (≤500)' },
  mentor_note_placeholder: { en: 'A quiet word of encouragement…', fr: 'Un mot doux d’encouragement…', ar: 'كلمة تشجيع لطيفة…', darija: 'كلمة تشجيع لطيفة…' },
  mentor_send: { en: 'Send note', fr: 'Envoyer la note', ar: 'أرسل الملاحظة', darija: 'أرسل الملاحظة' },
  mentor_notes: { en: 'Notes sent', fr: 'Notes envoyées', ar: 'الملاحظات المرسلة', darija: 'الملاحظات المرسلة' },
  mentor_aggregates: { en: 'Teacher dashboard shows aggregates only — never per-child surveillance.', fr: 'Le tableau enseignant montre uniquement des agrégats — jamais de surveillance individuelle.', ar: 'لوحة المعلم تعرض تعميمات فقط — أبداً مراقبة فردية.', darija: 'لوحة الأستاذ كتعرض تعميمات برك — أبداً مراقبة فردية.' },
  dash_title: { en: 'Teacher dashboard', fr: 'Tableau enseignant', ar: 'لوحة المعلم', darija: 'لوحة الأستاذ' },
  dash_sub: { en: 'Aggregates only — no per-child surveillance.', fr: 'Agrégats uniquement — aucune surveillance individuelle.', ar: 'تعميمات فقط — لا مراقبة فردية.', darija: 'تعميمات برك — لا مراقبة فردية.' },
  stuck_first: { en: 'Stuck concepts first', fr: 'Notions bloquées d’abord', ar: 'المفاهيم العالقة أولاً', darija: 'المفاهيم العالقة لول' },
  stuck: { en: 'stuck', fr: 'bloqué', ar: 'عالق', darija: 'عالق' },
  dash_empty: { en: 'No sessions yet.', fr: 'Aucune séance.', ar: 'لا توجد جلسات.', darija: 'ما فماش جلسات.' },
  style_mix: { en: 'Style mix', fr: 'Mélange de styles', ar: 'مزيج الأساليب', darija: 'مزيج الأساليب' },
  // "visual-first" was English glued onto a translated noun. {s} is the style word.
  style_first: { en: '{s}-first', fr: 'à dominante {s}', ar: 'غالباً {s}', darija: 'غالباً {s}' },
  sbu_trends: { en: 'S-B-U trends', fr: 'Tendances S-B-U', ar: 'اتجاهات S-B-U', darija: 'اتجاهات S-B-U' },
  lab_title: { en: 'Lab — engineering proof', fr: 'Labo — preuve technique', ar: 'المختبر — إثبات هندسي', darija: 'اللابو — إثبات هندسي' },
  lab_sub: { en: 'Route table, live meters, chaos console, event chain.', fr: 'Table des routes, compteurs, console de chaos, chaîne d’événements.', ar: 'جدول المسارات، عدّادات، وحدة فوضى، سجل الأحداث.', darija: 'جدول المسارات، عدّادات، وحدة فوضى، سجل الأحداث.' },
  route_table: { en: 'Route table — step → tier → why', fr: 'Table des routes — étape → niveau → pourquoi', ar: 'جدول المسارات — خطوة → مستوى → سبب', darija: 'جدول المسارات — خطوة → مستوى → سبب' },
  step: { en: 'Step', fr: 'Étape', ar: 'الخطوة', darija: 'الخطوة' },
  tier: { en: 'Tier', fr: 'Niveau', ar: 'المستوى', darija: 'المستوى' },
  why: { en: 'Why', fr: 'Pourquoi', ar: 'السبب', darija: 'السبب' },
  l_share: { en: 'L-share (target < 25%)', fr: 'Part L (cible < 25 %)', ar: 'حصة L (الهدف < 25 %)', darija: 'حصة L (الهدف < 25 %)' },
  l_share_target: { en: 'Larger-model calls as a share of all AI calls — the scored number.', fr: 'Appels au grand modèle parmi tous les appels IA — le chiffre noté.', ar: 'استدعاءات النموذج الكبيرAmong كل استدعاءات الذكاء الاصطناعي — الرقم المُقيَّم.', darija: 'استدعاءات النموذج الكبير من بين كل استدعاءات الذكاء الاصطناعي — الرقم اللي كيتقيّم.' },
  live_meters: { en: 'Live meters', fr: 'Compteurs en direct', ar: 'عدّادات مباشرة', darija: 'عدّادات مباشرة' },
  cache_hit: { en: 'cache hit', fr: 'cache', ar: 'إصابة الذاكرة', darija: 'إصابة الذاكرة' },
  peer_first_rate: { en: 'peer-first', fr: 'pairs d’abord', ar: 'الزملاء أولاً', darija: 'الزملاء لولين' },
  fallbacks: { en: 'fallbacks', fr: 'repli', ar: 'البدائل', darija: 'البدائل' },
  kb_docs: { en: 'KB docs', fr: 'docs KB', ar: 'وثائق القاعدة', darija: 'وثائق القاعدة' },
  offline_snippets: { en: 'offline snippets', fr: 'extraits hors ligne', ar: 'مقتطفات دون اتصال', darija: 'مقتطفات بلا اتصال' },
  chaos_console: { en: 'Chaos console', fr: 'Console de chaos', ar: 'وحدة الفوضى', darija: 'وحدة الفوضى' },
  replay_walk: { en: 'Replay walk (film all four modes)', fr: 'Rejouer la démo (filmer les 4 modes)', ar: 'أعد العرض (صوّر الأوضاع الأربعة)', darija: 'أعد العرض (صوّر الأوضاع الأربعة)' },
  budgets: { en: 'Budgets: skeleton < 1.5 s · compact < 4 s · larger < 12 s.', fr: 'Budgets : squelette < 1,5 s · compact < 4 s · large < 12 s.', ar: 'الميزانيات: هيكل < 1.5 ث · مختصر < 4 ث · موسّع < 12 ث.', darija: 'الميزانيات: هيكل < 1.5 ث · مختصر < 4 ث · موسّع < 12 ث.' },
  event_log: { en: 'Event log', fr: 'Journal des événements', ar: 'سجل الأحداث', darija: 'سجل الأحداث' },
  no_events: { en: 'No events yet — ask the first question.', fr: 'Aucun événement — posez la première question.', ar: 'لا أحداث — اطرح السؤال الأول.', darija: 'ما فماش أحداث — سقسا أول سؤال.' },
  // §4 R8 — debrief (P4)
  debrief_title: { en: 'Debrief — what stuck', fr: 'Bilan — ce qui est resté', ar: 'الخلاصة — ما الذي رسخ', darija: 'الخلاصة — شنو اللي بقي' },
  debrief_sub: { en: 'Three cards close the loop: notes, battle, relay.', fr: 'Trois cartes ferment la boucle : notes, bataille, relais.', ar: 'ثلاث بطاقات تُغلق الحلقة: ملاحظات، معركة، تتابع.', darija: 'ثلاث كروش كيغلقو الحلقة: ملاحظات، معركة، تتابع.' },
  capsule: { en: 'Revision capsule', fr: 'Fiche de révision', ar: 'بطاقة المراجعة', darija: 'كارnet المراجعة' },
  capsule_building: { en: 'Extracting the essentials…', fr: 'Extraction de l’essentiel…', ar: 'جارٍ استخلاص الجوهر…', darija: 'جارٍ استخراج الجوهر…' },
  next_step: { en: 'Next', fr: 'Suivant', ar: 'التالي', darija: 'التالي' },
  mini_quiz: { en: 'Check yourself', fr: 'Vérifie-toi', ar: 'اختبر نفسك', darija: 'جرّب راسك' },
  battle: { en: 'Boss battle', fr: 'Bataille finale', ar: 'المعركة النهائية', darija: 'المعركة الأخيرة' },
  battle_start: { en: 'Start battle', fr: 'Démarrer la bataille', ar: 'ابدأ المعركة', darija: 'ابدأ المعركة' },
  battle_win: { en: 'Correct — cited ✓', fr: 'Correct — source ✓', ar: 'صحيح — بالمصدر ✓', darija: 'صحيح — بالمصدر ✓' },
  battle_retry: { en: 'Not quite — re-check the cited card', fr: 'Pas tout à fait — revérifie la carte', ar: 'ليس تماماً — أعد فحص البطاقة', darija: 'مش تمام — عاود شوف الكارnet' },
  whisper: { en: 'Whisper chain', fr: 'Chaîne de chuchotement', ar: 'سلسلة الهمس', darija: 'سلسلة الهمس' },
  whisper_turn: { en: 'Your turn — what do you still remember?', fr: 'À toi — que retiens-tu ?', ar: 'دورك — ماذا تتذكر؟', darija: 'دورك — شنو تتذكر؟' },
  whisper_placeholder: { en: 'Explain it to the next person…', fr: 'Explique à la personne suivante…', ar: 'اشرح للشخص التالي…', darija: 'اشرح لللي بعدك…' },
  whisper_start: { en: 'Run relay', fr: 'Lancer le relais', ar: 'تشغيل التتابع', darija: 'شغّل التتابع' },
  whisper_repair: { en: 'Repair together', fr: 'Réparer ensemble', ar: 'إصلاح معاً', darija: 'صلّحو مع بعض' },
  whisper_need_two: { en: 'Relay needs two links — add what you remember.', fr: 'Le relais demande deux maillons — ajoute ce dont tu te souviens.', ar: 'التتابع يحتاج حلقتين — أضف ما تتذكره.', darija: 'التتابع يحتاج حلقتين — زيد شنو تتذكر.' },
  whisper_failed: { en: 'Relay failed — retry.', fr: 'Relais impossible — réessaie.', ar: 'فشل التتابع — حاول مجدداً.', darija: 'فشل التتابع — عاود حاول.' },
  coverage: { en: 'coverage', fr: 'couverture', ar: 'التغطية', darija: 'التغطية' },
  badges_hint: { en: 'Badges unlock as you help.', fr: 'Les badges se débloquent en aidant.', ar: 'تُفتح الأوسمة بمساعدة الآخرين.', darija: 'الأوسمة كتفتح كتعاون.' },
  drift_map: { en: 'Drift map', fr: 'Carte des dérives', ar: 'خريطة الانحراف', darija: 'خريطة الانحراف' },
  drift_kept: { en: 'kept ✓', fr: 'gardé ✓', ar: 'محفوظ ✓', darija: 'محفوظ ✓' },
  drift_lost: { en: 'lost', fr: 'perdu', ar: 'مفقود', darija: 'مفقود' },
  drift_distorted: { en: 'distorted', fr: 'déformé', ar: 'مشوّه', darija: 'مشوّه' },
  drift_added: { en: 'added', fr: 'ajouté', ar: 'مضاف', darija: 'مزاد' },
  end_session: { en: 'Session closed', fr: 'Séance terminée', ar: 'انتهت الجلسة', darija: 'انتهت الجلسة' },
  end_summary: { en: '{n} learners contributed · circle first, AI second', fr: '{n} apprenants ont contribué · le cercle d’abord', ar: '{n} متعلّمين شاركوا · الحلقة أولاً', darija: '{n} متعلّمين شاركو · الحلقة لول' },
  // §4 R7 — session room
  agenda: { en: 'Agenda', fr: 'Déroulé', ar: 'الأجندة', darija: 'الأجندة' },
  members: { en: 'Members', fr: 'Membres', ar: 'الأعضاء', darija: 'الأعضاء' },
  health: { en: 'Circle health', fr: 'Santé du cercle', ar: 'صحة الحلقة', darija: 'صحة الحلقة' },
  budget: { en: 'Budget', fr: 'Budget', ar: 'الميزانية', darija: 'الميزانية' },
  debrief: { en: 'Debrief →', fr: 'Bilan →', ar: 'الخلاصة →', darija: 'الخلاصة →' },
  no_questions: { en: 'Ask the first question', fr: 'Pose la première question', ar: 'اطرح السؤال الأول', darija: 'سقسا أول سؤال' },
  ask_hint: { en: 'Peers answer first — Nova prepares quietly', fr: 'Les pairs d’abord — Nova prépare en silence', ar: 'الزملاء أولاً — Nova تحضّر بصمت', darija: 'الزملاء هوما لولين — Nova تحضّر في صمت' },
  peer_answers: { en: 'peer answers', fr: 'réponses de pairs', ar: 'إجابات الزملاء', darija: 'إجابات الزملاء' },
  me_too_done: { en: '✓ you’re counted', fr: '✓ tu comptes', ar: '✓ تمّ العدّ', darija: '✓ محسوب' },
  read_full: { en: 'Read full', fr: 'Tout lire', ar: 'اقرأ الكل', darija: 'اقرا الكل' },
  read_less: { en: 'Show less', fr: 'Réduire', ar: 'أقل', darija: 'أقل' },
  anonymous: { en: 'Anonymous', fr: 'Anonyme', ar: 'مجهول', darija: 'مجهول' },
  hint_ladder: { en: 'Hint ladder', fr: 'Échelle d’indices', ar: 'سُلّم التلميحات', darija: 'سُلّم الـhints' },
  hint_locked: { en: 'locked until hint', fr: 'verrouillé avant l’indice', ar: 'مقفل قبل التلميح', darija: 'مقفل قبل الـhint' },
  close_poll: { en: 'Close poll', fr: 'Clôturer', ar: 'أغلق التصويت', darija: 'سدّ التصويت' },
  winner: { en: 'Winner', fr: 'Gagnant', ar: 'الفائز', darija: 'الفائز' },
  poll_choice: { en: 'Sound answer', fr: 'Réponse solide', ar: 'إجابة سليمة', darija: 'إجابة صحيحة' },
  poll_fix: { en: 'Needs a fix', fr: 'À corriger', ar: 'تحتاج تصحيحاً', darija: 'تنجم تتصلح' },
  thinking_note: { en: 'compact < 4 s · larger < 12 s', fr: 'compact < 4 s · approfondi < 12 s', ar: 'مختصر < 4 ث · معمّق < 12 ث', darija: 'مختصر < 4 ث · معمّق < 12 ث' },
  needs_human: { en: 'Needs a human — invite quiet voices', fr: 'Besoin d’un humain — invite les voix discrètes', ar: 'يحتاج إنساناً — ادعُ الأصوات الهادئة', darija: 'لازم واحد بشري — عيّط للصوات الهادية' },
  nudge: { en: 'Nudge privately', fr: 'Relance en privé', ar: 'تنبيه خاص', darija: 'تنبيه خاص' },
  nudge_sent: { en: 'Nudge sent privately ✓', fr: 'Relance envoyée en privé ✓', ar: 'أُرسل التنبيه خاصّة ✓', darija: 'التنبيه صار خاص ✓' },
  rephrase: { en: 'Rephrase (1 × C)', fr: 'Reformuler (1 × C)', ar: 'أعد الصياغة (1 × C)', darija: 'أعد الصياغة (1 × C)' },
  credits_formula: { en: '2·ln(1+n) on plain talk · quality actions weigh 3', fr: '2·ln(1+n) en discussion · les actions utiles pèsent 3', ar: '2·ln(1+n) للحديث العادي · الأفعال النوعية بوزن 3', darija: '2·ln(1+n) للكلام العادي · الأفعال النوعية وزنهم 3' },
  tier_bright: { en: 'bright', fr: 'fort', ar: 'قوي', darija: 'قوي' },
  tier_steady: { en: 'steady', fr: 'stable', ar: 'ثابت', darija: 'ثابت' },
  tier_pulse: { en: 'needs care', fr: 'à surveiller', ar: 'يحتاج عناية', darija: 'يحتاج عناية' },
  stale_s: { en: 'stale {n}s', fr: 'périmé {n}s', ar: 'قديم {n}ث', darija: 'قديم {n}ث' },

  /* ── design-system pass: labels that were hardcoded English or raw API enums ── */

  // agenda steps — the API sends `goal|explain|challenge|teachback|recap`
  step_goal: { en: 'Goal', fr: 'Objectif', ar: 'الهدف', darija: 'الهدف' },
  step_explain: { en: 'Explain', fr: 'Expliquer', ar: 'الشرح', darija: 'الشرح' },
  step_challenge: { en: 'Challenge', fr: 'Contester', ar: 'التحدي', darija: 'التحدي' },
  step_teachback: { en: 'Teach back', fr: 'Réexpliquer', ar: 'أعد التعليم', darija: 'عاود علّم' },
  step_recap: { en: 'Recap', fr: 'Récap', ar: 'الخلاصة', darija: 'الخلاصة' },

  // hats — previously bilingual-in-every-language
  hat_mediator: { en: 'Mediator', fr: 'Médiateur', ar: 'وسيط', darija: 'وسيط' },
  hat_teammate: { en: 'Teammate', fr: 'Camarade', ar: 'زميل', darija: 'صاحب' },
  hat_tutor: { en: 'Tutor', fr: 'Tuteur', ar: 'معلّم', darija: 'أستاذ' },
  hat_facilitator: { en: 'Facilitator', fr: 'Animateur', ar: 'مسيّر', darija: 'مسيّر' },
  hat_nova_curious: { en: 'Nova · curious', fr: 'Nova · curieuse', ar: 'Nova · فضولية', darija: 'Nova · فضولية' },
  hat_nova_skeptic: { en: 'Nova · skeptic', fr: 'Nova · sceptique', ar: 'Nova · متشككة', darija: 'Nova · متشككة' },
  hat_nova_examiner: { en: 'Nova · examiner', fr: 'Nova · examinatrice', ar: 'Nova · ممتحِنة', darija: 'Nova · ممتحنة' },
  hat_nova: { en: 'Nova', fr: 'Nova', ar: 'Nova', darija: 'Nova' },
  // The API sends `host|peer|mentor|observer` (CircleMember.role); the lobby used
  // to print the raw enum, and `member` was in this map while never being emitted.
  role_host: { en: 'host', fr: 'hôte', ar: 'المضيف', darija: 'المضيف' },
  role_peer: { en: 'peer', fr: 'pair', ar: 'زميل', darija: 'صاحب' },
  role_mentor: { en: 'mentor', fr: 'mentor', ar: 'مرشد', darija: 'مرشد' },
  role_observer: { en: 'observer', fr: 'observateur', ar: 'ملاحظ', darija: 'ملاحظ' },

  // Nova's staged-progress labels (`retrieving`, `checking_similar` are API enums)
  nova_progress: { en: 'Nova progress', fr: 'Progression de Nova', ar: 'تقدّم Nova', darija: 'تقدّم Nova' },
  stage_retrieving: { en: 'Searching the circle’s sources', fr: 'Recherche dans les sources du cercle', ar: 'البحث في مصادر الحلقة', darija: 'القلب في مصادر الحلقة' },
  stage_checking_similar: { en: 'Checking similar questions', fr: 'Vérification des questions proches', ar: 'التحقق من الأسئلة المشابهة', darija: 'التحقق من الأسئلة المتشابهة' },
  tier_compact: { en: 'compact model', fr: 'modèle compact', ar: 'نموذج مضغوط', darija: 'نموذج مضغوط' },
  tier_offline: { en: 'offline card', fr: 'carte hors ligne', ar: 'بطاقة دون اتصال', darija: 'بطاقة بلا كونكسيون' },
  // the solo picker shows the hat alone, so these stay short
  nova_novice: { en: 'Novice', fr: 'Débutante', ar: 'مبتدئة', darija: 'مبتدئة' },
  nova_skeptic: { en: 'Skeptic', fr: 'Sceptique', ar: 'متشككة', darija: 'متشككة' },
  nova_curious: { en: 'Curious', fr: 'Curieuse', ar: 'فضولية', darija: 'فضولية' },
  nova_examiner: { en: 'Examiner', fr: 'Examinatrice', ar: 'ممتحِنة', darija: 'ممتحنة' },

  // S / B / U legend
  sbu_group: { en: 'Circle health: structured, balanced, understood', fr: 'Santé du cercle : structuré, équilibré, compris', ar: 'صحة الحلقة: منظّم، متوازن، مفهوم', darija: 'صحة الحلقة: منظّم، متوازن، مفهوم' },
  sbu_structured: { en: 'Structured', fr: 'Structuré', ar: 'منظّم', darija: 'منظّم' },
  sbu_balanced: { en: 'Balanced', fr: 'Équilibré', ar: 'متوازن', darija: 'متوازن' },
  sbu_understood: { en: 'Understood', fr: 'Compris', ar: 'مفهوم', darija: 'مفهوم' },
  sbu_ring: {
    en: '{name}: {v}',
    fr: '{name} : {v}',
    ar: '{name}: {v}',
    darija: '{name}: {v}',
  },
  credit_dot: { en: '{n} credits', fr: '{n} crédits', ar: '{n} رصيد', darija: '{n} كريديت' },

  // quota + countdown + loading
  quota_label: { en: 'Compact {c} of {cc}, larger {l} of {lc}', fr: 'Compact {c} sur {cc}, large {l} sur {lc}', ar: 'المضغوط {c} من {cc}، الموسّع {l} من {lc}', darija: 'المضغوط {c} من {cc}، الموسّع {l} من {lc}' },
  countdown_left: { en: '{n} seconds left for peers', fr: 'Encore {n} secondes pour les pairs', ar: 'بقيت {n} ثانية للزملاء', darija: 'بقات {n} ثانية للزملاء' },
  source_n: { en: 'Source {n}', fr: 'Source {n}', ar: 'المصدر {n}', darija: 'المصدر {n}' },
  loading: { en: 'Loading…', fr: 'Chargement…', ar: 'جارٍ التحميل…', darija: 'كيحمّل…' },
  nav_label: { en: 'Main navigation', fr: 'Navigation principale', ar: 'التنقل الرئيسي', darija: 'التنقّل الرئيسي' },

  // landmark / group names — screen readers announce these, so they cannot stay English
  questions_label: { en: 'Questions', fr: 'Questions', ar: 'الأسئلة', darija: 'الأسئلة' },
  rail_agenda: { en: 'Agenda, members and credits', fr: 'Déroulé, membres et crédits', ar: 'الأجندة والأعضاء والاعتمادات', darija: 'الأجندة والأعضاء والاعتمادات' },
  rail_health: { en: 'Health and budget', fr: 'Santé et budget', ar: 'الصحة والميزانية', darija: 'الصحة والميزانية' },
  poll_label: { en: 'Poll', fr: 'Sondage', ar: 'استطلاع', darija: 'استطلاع' },
  solo_hat: { en: 'Nova hat', fr: 'Chapeau de Nova', ar: 'قبعة Nova', darija: 'قبعة Nova' },
  solo_thread: { en: 'Nova and teacher thread', fr: 'Fil Nova et enseignant', ar: 'خيط Nova والمعلّم', darija: 'خيط Nova والأستاذ' },
  dismiss: { en: 'Dismiss', fr: 'Fermer', ar: 'إغلاق', darija: 'سدّ' },
  // question-card landmark. The state machine enum (`OPEN`, …) is not a word.
  question_label: { en: 'Question — {state}', fr: 'Question — {state}', ar: 'سؤال — {state}', darija: 'سؤال — {state}' },
  state_open: { en: 'peers answering', fr: 'les pairs répondent', ar: 'الزملاء يجيبون', darija: 'الزملاء كيجاوبو' },
  state_nova_thinking: { en: 'Nova thinking', fr: 'Nova réfléchit', ar: 'Nova تفكّر', darija: 'Nova كتفكّر' },
  state_resolved: { en: 'answered', fr: 'répondu', ar: 'تمّت الإجابة', darija: 'تجاوبت' },
  // Oversight screens used to head every card with a raw Mongo id. The id stays
  // (mentors need it to open a circle) but it is no longer the title.
  session_n: { en: 'Session {n}', fr: 'Séance {n}', ar: 'جلسة {n}', darija: 'جلسة {n}' },
  match_group: { en: 'Suggested group {n}', fr: 'Groupe proposé {n}', ar: 'مجموعة مقترحة {n}', darija: 'مجموعة مقترحة {n}' },
  reload: { en: 'Reload', fr: 'Recharger', ar: 'إعادة التحميل', darija: 'عاود حمّل' },
  sw_newer: { en: 'A newer version is available.', fr: 'Une nouvelle version est disponible.', ar: 'تتوفر نسخة أحدث.', darija: 'كاينة نسخة جديدة.' },
  api_down: { en: 'API unreachable at {base} — offline tools still work.', fr: 'API injoignable à {base} — les outils hors ligne fonctionnent.', ar: 'تعذّر الوصول إلى API على {base} — الأدوات دون اتصال تعمل.', darija: 'API ما تجاوبش في {base} — الأدوات بلا كونكسيون خدّامة.' },

  // passport sheet
  pw_rotated: { en: 'Passphrase updated ✓', fr: 'Phrase mise à jour ✓', ar: 'تم تحديث العبارة ✓', darija: 'العبارة تبدّلت ✓' },
  account: { en: 'Account', fr: 'Compte', ar: 'الحساب', darija: 'الحساب' },
  pw_wrong_current: { en: 'Wrong current passphrase.', fr: 'Phrase actuelle incorrecte.', ar: 'العبارة الحالية خاطئة.', darija: 'العبارة الحالية غالطة.' },
  pw_too_short: { en: 'Use at least 8 characters.', fr: 'Utilisez au moins 8 caractères.', ar: 'استعمل 8 أحرف على الأقل.', darija: 'استعمل 8 حروف على الأقل.' },
  pw_update_failed: { en: 'Could not update — try again.', fr: 'Mise à jour impossible — réessayez.', ar: 'تعذّر التحديث — حاول مجدداً.', darija: 'ما قدرناش نبدّلو — عاود حاول.' },
  pw_min_hint: { en: '8 characters minimum. Rotating signs other devices out.', fr: '8 caractères minimum. La rotation déconnecte les autres appareils.', ar: '8 أحرف على الأقل. التدوير يُخرج الأجهزة الأخرى.', darija: '8 حروف على الأقل. التدوير كيخرّج الأجهزة لخرين.' },
  avatar_hint: { en: 'Your peers see this glyph next to your name.', fr: 'Vos pairs voient ce symbole à côté de votre nom.', ar: 'يرى أقرانك هذا الرمز بجانب اسمك.', darija: 'الرفاق كيشوفو هاد الرمز حدا سميتك.' },
  avatar_saved: { en: 'Avatar updated ✓', fr: 'Avatar mis à jour ✓', ar: 'تم تحديث الصورة ✓', darija: 'الصورة تبدّلت ✓' },
  avatar_failed: { en: 'Could not update avatar — try again.', fr: 'Mise à jour de l’avatar impossible — réessayez.', ar: 'تعذّر تحديث الصورة — حاول مجدداً.', darija: 'ما قدرناش نبدّلو الصورة — عاود حاول.' },
  pw_updating: { en: 'Updating…', fr: 'Mise à jour…', ar: 'جارٍ التحديث…', darija: 'كيتبدّل…' },
  signing_out: { en: 'Signing out…', fr: 'Déconnexion…', ar: 'جارٍ الخروج…', darija: 'كيخرج…' },
  signout_hint: { en: 'Revokes this device token.', fr: 'Révoque le jeton de cet appareil.', ar: 'يُبطل رمز هذا الجهاز.', darija: 'كيبطّل رمز هاد الجهاز.' },
  guest_record_hint: { en: 'This is still a guest record. Claim an account from', fr: 'Ceci est encore un dossier invité. Créez un compte depuis', ar: 'هذا سجل ضيف. أنشئ حساباً من', darija: 'هاد سجل ضيف. دير حساب من' },
  guest_record_tail: { en: 'to keep your passport on any device.', fr: 'pour garder votre passeport sur tout appareil.', ar: 'للاحتفاظ بجوازك على أي جهاز.', darija: 'باش يبقى الجواز ديالك ف أي جهاز.' },
  xp_badges: { en: 'XP {n} · badges {b}', fr: 'XP {n} · badges {b}', ar: 'XP {n} · الأوسمة {b}', darija: 'XP {n} · الأوسمة {b}' },

  // coach rephrase styles — the API requires one of these
  coach_style: { en: 'Explaining style', fr: 'Style d’explication', ar: 'أسلوب الشرح', darija: 'أسلوب الشرح' },
  style_visual: { en: 'Visual', fr: 'Visuel', ar: 'بصري', darija: 'بصري' },
  style_analogy: { en: 'Analogy', fr: 'Analogie', ar: 'تشبيه', darija: 'تشبيه' },
  style_steps: { en: 'Step by step', fr: 'Étape par étape', ar: 'خطوة بخطوة', darija: 'خطوة بخطوة' },
  style_example: { en: 'Example', fr: 'Exemple', ar: 'مثال', darija: 'مثال' },
  style_repetition: { en: 'Repetition', fr: 'Répétition', ar: 'تكرار', darija: 'تكرار' },
  style_practice: { en: 'Practice', fr: 'Pratique', ar: 'تمرين', darija: 'تمرين' },

  // shared error / empty-state recovery
  load_failed: { en: 'Could not load — retry.', fr: 'Chargement impossible — réessayez.', ar: 'تعذّر التحميل — حاول مجدداً.', darija: 'ما قدرناش نحمّل — عاود حاول.' },
  dashboard_private: { en: 'This dashboard shows aggregates only — no individual talk shares.', fr: 'Ce tableau ne montre que des agrégats — pas de part individuelle.', ar: 'هذه اللوحة تعرض المجاميع فقط — دون حصة فردية.', darija: 'هاد اللوحة كتبيّن المجاميع غير — بلا حصة فردية.' },
  mentor_need_session: { en: 'Start a session first — the brief is written from a live session.', fr: 'Lancez d’abord une séance — le brief vient d’une séance en cours.', ar: 'ابدأ جلسة أولاً — الملخص يُكتب من جلسة جارية.', darija: 'ابدا جلسة اللول — الملخص كيتكتب من جلسة خدّامة.' },

  // Landing hero. The copy is handed to Hero15 as props (the component owns no
  // strings of its own), so the whole page was English in all four languages
  // until these keys existed.
  landing_h1: { en: 'No voice', fr: 'Aucune voix', ar: 'لا صوت', darija: 'حتا صوت' },
  landing_h2: { en: 'left behind', fr: 'laissée de côté', ar: 'يُترك خلفنا', darija: 'ما كاين لي يتخلّى' },
  landing_desc: {
    en: 'Peer study circles, mediated by AI. Learners answer first; the AI steps in only afterwards — with a credit economy, an offline fallback and four languages.',
    fr: 'Des cercles d’étude entre pairs, mediés par l’IA. Les apprenants répondent d’abord ; l’IA n’intervient qu’ensuite — avec une économie de crédits, un mode hors ligne et quatre langues.',
    ar: 'حلقات دراسة بين الزملاء بوساطة الذكاء الاصطناعي. المتعلمون يجيبون أولاً، ثم يتدخل الذكاء الاصطناعي — مع اقتصاد أرصدة، ووضع دون اتصال، وأربع لغات.',
    darija: 'حلقات دراسة بين الزملاء بالذكاء الاصطناعي. المتعلمين كيجاوبو اللول، والذكاء الاصطناعي كيدخل من بعد — مع اقتصاد الكريديات، ووضع بلا إنترنت، وأربع لغات.',
  },
  landing_proof_eyebrow: { en: 'Peers first, by design', fr: 'Les pairs d’abord, par choix', ar: 'الزملاء أولاً، بالتصميم', darija: 'الزملاء هوما اللول، بالتصميم' },
  landing_proof_offline: { en: 'AI calls once the network drops', fr: 'appels IA une fois le réseau coupé', ar: 'نداءات للذكاء الاصطناعي بعد انقطاع الشبكة', darija: 'طلبات للذكاء الاصطناعي ملّي تقطع الشبكة' },
  landing_proof_ladder: { en: 'Hint ladder before any answer', fr: 'échelle d’indices avant toute réponse', ar: 'سلّم تلميحات قبل أي إجابة', darija: 'سلّم تلميحات قبل أي جواب' },
  landing_proof_langs: { en: 'French · Arabic · Darija · English', fr: 'français · arabe · darija · anglais', ar: 'الفرنسية · العربية · الدارجة · الإنجليزية', darija: 'الفرنسية · العربية · الدارجة · الإنجليزية' },
  // These were the last English strings still rendered in all four languages.
  solo_failed: {
    en: 'Solo session could not start.',
    fr: 'La séance solo n’a pas pu démarrer.',
    ar: 'لم تبدأ جلسة Solo.',
    darija: 'جلسة Solo ما بداتش.',
  },
  solo_turn_failed: {
    en: 'That turn did not send.',
    fr: 'Ce tour n’a pas été envoyé.',
    ar: 'لم تُرسل هذه المشاركة.',
    darija: 'هاد الدور ما تصيفطش.',
  },
  // Budget line: `{n}` compact calls, `{l}` larger calls out of `{m}` turns.
  solo_budget_mix: {
    en: '{n}/{m} compact · {l} larger',
    fr: '{n}/{m} compact · {l} large',
    ar: '{n}/{m} مضغوطة · {l} موسّعة',
    darija: '{n}/{m} مصغّرة · {l} موسّعة',
  },
  cl_calls: { en: 'C / L calls', fr: 'appels C / L', ar: 'نداءات C / L', darija: 'طلبات C / L' },
  // Knowledge-base topic ids are `binary_search` / `fractions`. Shown raw they
  // read as a variable name on the Board, in the Lobby and in the picker.
  topic_binary_search: {
    en: 'Binary search',
    fr: 'Recherche dichotomique',
    ar: 'البحث الثنائي',
    darija: 'البحث الثنائي',
  },
  topic_fractions: { en: 'Fractions', fr: 'Fractions', ar: 'الكسور', darija: 'الكسور' },
  arabizi_note: {
    en: 'Arabizi → Darija ✓',
    fr: 'Arabizi → Darija ✓',
    ar: 'عربيزي ← دارجة ✓',
    darija: 'عربيزي ← دارجة ✓',
  },
  // Lab route-table rationale. The step names stay untranslated (they are
  // pipeline identifiers marked translate="no"); these are the prose reasons.
  lab_why_pulse: {
    en: 'bounded JSON, 1 call/turn shared by credits+confusion',
    fr: 'JSON borné, 1 appel/tour partagé par crédits+confusion',
    ar: 'JSON محدود، نداء واحد لكل دور تشترك فيه الأرصدة والارتباك',
    darija: 'JSON محدود، طلب واحد فكل دور كيتشاركو فيه الكريديات والخلطة',
  },
  lab_why_retrieval: {
    en: 'deterministic, zero quota',
    fr: 'déterministe, zéro quota',
    ar: 'حتمي، بلا حصة',
    darija: 'محسوم، بلا كوطا',
  },
  lab_why_quick_take: {
    en: 'single-source, hidden prep',
    fr: 'source unique, préparation masquée',
    ar: 'مصدر واحد، تحضير مخفي',
    darija: 'مصدر وحد، تحضير مخبّي',
  },
  lab_why_deep_dive: {
    en: 'multi-source synthesis only; queued + fallback',
    fr: 'synthèse multi-sources uniquement ; en file + repli',
    ar: 'تركيب متعدد المصادر فقط؛ في الانتظار + بديل',
    darija: 'تركيب من بزاف مصادر برك؛ فالصف + بديل',
  },
  lab_why_hints: {
    en: 'zero calls; L4 = quick take behind hintState≥3|skip gate',
    fr: 'zéro appel ; L4 = quick take derrière hintState≥3|skip',
    ar: 'بلا نداءات؛ L4 = إجابة سريعة خلف شرط hintState≥3|تخطٍ',
    darija: 'بلا طلبات؛ L4 = جواب سريع مورا شرط hintState≥3|تخطّي',
  },
  lab_why_auditor: {
    en: 'bounded classify; poll-first on doubt',
    fr: 'classification bornée ; sondage d’abord en cas de doute',
    ar: 'تصنيف محدود؛ استطلاع أولاً عند الشك',
    darija: 'تصنيف محدود؛ سطّاج أولاً إلا كان شك',
  },
  lab_why_capsule: {
    en: 'the one luxury call',
    fr: 'le seul appel de luxe',
    ar: 'النداء الكمالي الوحيد',
    darija: 'الطلب الكمالي الوحيد',
  },
  lab_why_whisper: {
    en: 'checklist-bounded classify vs claim ids',
    fr: 'classification bornée par liste vs identifiants de claims',
    ar: 'تصنيف محدود بقائمة مقابل معرّفات الادعاءات',
    darija: 'تصنيف محدود بلائحة مقابل معرّفات الادعاءات',
  },
  lab_why_mentor: {
    en: 'extractive aggregation',
    fr: 'agrégation extractive',
    ar: 'تجميع استخلاصي',
    darija: 'تجميع استخلاصي',
  },
  lab_why_solo: {
    en: 'rephrase only; templates carry the pedagogy',
    fr: 'reformulation seule ; les gabarits portent la pédagogie',
    ar: 'إعادة صياغة فقط؛ القوالب تحمل البيداغوجيا',
    darija: 'إعادة صياغة برك؛ القوالب هي اللي كتحمل البيداغوجيا',
  },
  landing_footnote: {
    // The FR line used to be the EN sentence with a French clause appended by a
    // `lang === 'fr' &&` conditional; folding it in keeps one sentence per language.
    en: 'Anonymous · synthetic data only · the AI supports teachers, never replaces them · IEEE SB / WIE',
    fr: 'Anonyme · données synthétiques uniquement · l’IA aide les enseignants, elle ne les remplace jamais · IEEE SB / WIE · Aucune voix laissée de côté.',
    ar: 'مجهول الهوية · بيانات اصطناعية فقط · الذكاء الاصطناعي يساند الأساتذة ولا ينيب عنهم · IEEE SB / WIE',
    darija: 'بلا هوية · بيانات اصطناعية غير · الذكاء الاصطناعي كيعاون الأساتذة وما كيعوّضهمش · IEEE SB / WIE',
  },
};

/** The API speaks in enum values (`goal`, `explain`, …). Learners should not.
 *  One map, so every screen that renders an agenda step reads the same word. */
const STEP_KEYS: Record<string, string> = {
  goal: 'step_goal',
  explain: 'step_explain',
  challenge: 'step_challenge',
  teachback: 'step_teachback',
  recap: 'step_recap',
};

export const stepLabel = (step: string, lang: Lang): string => {
  const key = STEP_KEYS[step];
  return key ? t(key, lang) : step;
};

/** The coach `style` enum label — the value set itself lives in `api.ts`, which owns
 *  the contract; this only turns a member of it into words. */
export const styleLabel = (style: string, lang: Lang): string =>
  t(`style_${style}` in STRINGS ? `style_${style}` : style, lang);

/** Circle roles are an API enum (`host|mentor|member`), not words. */
export const roleLabel = (role: string, lang: Lang): string => {
  const k = role.toLowerCase();
  return t(`role_${k}` in STRINGS ? `role_${k}` : role, lang);
};

/** Nova's staged-progress enum → words. Unknown stages keep their raw value
 *  rather than disappearing, so a new backend stage is never silently hidden. */
export const stageLabel = (stage: string, lang: Lang): string =>
  t(`stage_${stage}` in STRINGS ? `stage_${stage}` : stage.replace(/_/g, ' '), lang);

/** Knowledge-base topic ids are the API's (`binary_search`, `fractions`). An
 *  unknown topic keeps its raw id rather than vanishing, so a topic added to the
 *  KB without a translation still shows up in the picker. */
export const topicLabel = (topic: string, lang: Lang): string => {
  const k = `topic_${topic.toLowerCase()}`;
  return t(k in STRINGS ? k : topic.replace(/_/g, ' '), lang);
};

/** `tierUsed` is `C` (compact) or `T0` (offline card). */
export const tierLabel = (tier: string, lang: Lang): string =>
  tier === 'T0' ? t('tier_offline', lang) : tier === 'C' ? t('tier_compact', lang) : tier;

/** The CF-AS state machine enum (`OPEN|NOVA_THINKING|RESOLVED`) is read aloud by
 *  screen readers as the card's name, so it has to be a phrase, not a constant. */
export const stateLabel = (state: string, lang: Lang): string => {
  const k = `state_${state.toLowerCase()}`;
  return t(k in STRINGS ? k : state, lang);
};

export const hatLabel = (hat: string, lang: Lang): string => {
  const map: Record<string, string> = {
    Mediator: 'hat_mediator',
    Teammate: 'hat_teammate',
    Tutor: 'hat_tutor',
    Facilitator: 'hat_facilitator',
    NOVA_NOVICE: 'hat_nova_curious',
    NOVA_CURIOUS: 'hat_nova_curious',
    NOVA_SKEPTIC: 'hat_nova_skeptic',
    NOVA_EXAMINER: 'hat_nova_examiner',
    NOVA: 'hat_nova',
  };
  const key = map[hat];
  return key ? t(key, lang) : hat;
};

export function t(key: string, lang: Lang, vars?: Record<string, string | number>): string {
  let s = STRINGS[key]?.[lang] ?? STRINGS[key]?.en ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Darija is written in Arabic script, so it needs the same RTL flow and face as `ar`.
 *  Leaving it out reversed every line the Algerian/Moroccan learners read. */
export const RTL: Lang[] = ['ar', 'darija'];
export type { Lang };
