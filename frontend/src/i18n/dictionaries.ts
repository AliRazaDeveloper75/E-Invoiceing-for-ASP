// Translation dictionaries for E-Numerak (English / Arabic).
// Add new namespaces here; access with useI18n().t('namespace.key').

export type Locale = 'en' | 'ar';

export const LOCALES: { code: Locale; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
];

export const dictionaries = {
  en: {
    nav: {
      home: 'Home',
      about: 'About',
      services: 'Services',
      peppol: 'E-Invoice',
      contact: 'Contact',
      signIn: 'Sign In',
      portal: 'E-Invoice Portal',
      language: 'Language',
    },
    footer: {
      tagline:
        '5-Corner compliant e-invoicing solution for UAE businesses. FTA-certified, VAT-ready, and built for the UAE digital economy.',
      platform: 'Platform',
      legal: 'Legal',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      ftaCompliance: 'FTA Compliance',
      rights: 'E-Numerak. All rights reserved.',
      certified: 'Federal Decree-Law No. 16 of 2024 • BIS 3.0 • UAE FTA Certified',
    },
    about: {
      hero: {
        tag: 'About Us',
        title: 'Built for the UAE Digital Economy',
        body:
          'We built E-Numerak to make FTA compliance straightforward — removing the complexity so businesses can focus on growth, not paperwork.',
      },
      valuesTitle: 'What Drives Us',
      values: [
        { title: 'Mission', desc: 'Simplify UAE e-invoicing compliance for businesses of all sizes through modern, developer-friendly tooling.' },
        { title: 'For Teams', desc: 'Multi-user, role-based access (Admin, Accountant, Viewer) so your entire finance team works in one place.' },
        { title: 'Security', desc: 'JWT authentication, company-scoped data isolation, and audit trails on every invoice action.' },
        { title: 'Certified', desc: 'Built against the FTA Tax Accounting Software Certification Guidelines for VAT and Excise Tax audit files.' },
      ],
      timelineTitle: 'UAE Tax & E-Invoicing Timeline',
      timeline: [
        { year: '2017', event: 'UAE Federal Decree-Law No. 8 — VAT introduced at 5%' },
        { year: '2019', event: 'VAT implementation — businesses required to register' },
        { year: '2022', event: 'Excise Tax expanded — energy drinks, tobacco, carbonated beverages' },
        { year: '2024', event: 'Federal Decree-Law No. 16 — e-invoicing mandated' },
        { year: '2026', event: 'Phase 1 E-Invoice B2B/B2G e-invoicing goes live' },
      ],
      cta: {
        title: 'Start Issuing Compliant Invoices',
        subtitle: 'Everything set up. Just log in and create your first invoice.',
        button: 'E-Invoice Portal',
      },
    },
    servicesPage: {
      hero: {
        tag: 'Our Services',
        title: 'Everything for E-Numerak Compliance',
        body:
          'A complete stack for generating, validating, and submitting invoices — covering all UAE FTA requirements without the complexity.',
      },
      cards: [
        {
          title: 'Tax Invoice Generation',
          desc: 'Create UAE-compliant Tax Invoices, Credit Notes, Commercial Invoices, and Continuous Supply invoices. UBL 2.1 XML auto-generated on every save.',
          tags: ['Tax Invoice', 'Credit Note', 'Commercial', 'Continuous Supply'],
        },
        {
          title: 'FTA Audit File (FAF)',
          desc: 'Capture all 21 VAT FAF and 32 Excise FAF data elements required under the UAE Tax Accounting Software Certification Guidelines.',
          tags: ['VAT FAF', 'Excise FAF', 'GL/ID', 'Permit Numbers', 'Reverse Charges'],
        },
        {
          title: 'Real-Time Validation',
          desc: 'Invoice header, line items, totals, TRN, and credit note references all validated before submission — errors surfaced instantly.',
          tags: ['Header Validation', 'TRN Check', 'VAT Calculation', 'Error Reporting'],
        },
        {
          title: 'PDF & XML Export',
          desc: 'Download human-readable PDF invoices and machine-readable UBL XML files for any invoice in any status.',
          tags: ['PDF Download', 'UBL XML', 'A4 Format', 'On-Demand'],
        },
        {
          title: 'VAT & Excise Reporting',
          desc: 'Dashboard with VAT breakdown by rate type (5%, zero, exempt, out-of-scope). Per-invoice VAT summary and company-wide revenue totals.',
          tags: ['VAT Summary', 'Excise Tax', 'Dashboard Stats', 'Revenue Totals'],
        },
        {
          title: 'Multi-Company & Team Access',
          desc: 'Manage multiple companies under one account. Invite team members with granular role-based permissions (Admin, Accountant, Viewer).',
          tags: ['Multi-Company', 'Role-Based', 'Admin', 'Accountant', 'Viewer'],
        },
      ],
      faf: {
        title: 'FAF Field Coverage',
        subtitle: 'All fields required by UAE Tax Accounting Software Certification Guidelines are captured.',
        vatTitle: 'VAT FAF Fields (21)',
        vatFields: [
          'Company name', 'User ID', 'TRN', 'FAF version indicator',
          'GL/ID', 'Locations of suppliers', 'Reverse charges', 'Locations of customers',
          'Tax codes', 'Invoice numbers', 'Invoice dates', 'Permit numbers',
          'Transaction IDs', 'Debit amounts', 'Credit amounts',
          'VAT amounts (actual currency)', 'VAT amounts (AED)',
          'Accounts receivable', 'Accounts payable',
          'Product/service references', 'Description of goods/services',
        ],
        exciseTitle: 'Excise FAF Extra Fields (11)',
        exciseFields: [
          'Designated zone (warehouse) identifiers',
          'Open stock balances (Excise Tax implementation)',
          'Product codes',
          'Excise rate per product',
          'Transaction types',
          'Details of movement',
          'Transaction dates',
          'Tax payment dates',
          'Duty status of stock',
          'Stock adjustments (write-offs, losses)',
          'Physical location of goods',
        ],
      },
      cta: {
        title: 'Try the Platform',
        subtitle: 'Create your first invoice in under 2 minutes.',
        button: 'E-Invoice Portal',
      },
    },
    contact: {
      hero: {
        tag: 'Contact',
        title: 'Get in Touch',
        body:
          'Questions about UAE e-invoicing compliance, E-Invoice integration, or the platform? Our team is here to help.',
      },
      formTitle: 'Send a Message',
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email Address',
      companyTrn: 'Company / TRN (optional)',
      subject: 'Subject',
      message: 'Message',
      firstNamePh: 'Ahmed',
      lastNamePh: 'Al Rashid',
      emailPh: 'ahmed@company.ae',
      companyPh: 'Company name or Tax Registration Number',
      subjectPh: 'Select a topic…',
      messagePh: 'Describe your question or requirement…',
      send: 'Send Message',
      sending: 'Sending…',
      sentTitle: 'Message Sent!',
      sentBody: "Thank you for reaching out. We'll get back to you within 24 hours.",
      sendAnother: 'Send Another Message',
      errRequired: 'Please fill in all required fields.',
      errGeneric: 'Something went wrong. Please try again or email us directly.',
      subjects: [
        { value: 'fta_compliance', label: 'FTA Compliance Question' },
        { value: 'peppol', label: 'E-Invoice Integration' },
        { value: 'support', label: 'Platform Support' },
        { value: 'pricing', label: 'Pricing / Demo' },
        { value: 'other', label: 'Other' },
      ],
      infoTitle: 'Contact Information',
      items: [
        { label: 'Email', value: 'info@e-numerak.com', sub: 'We respond within 24 hours' },
        { label: 'Phone', value: '+971 50 635 8421', sub: 'Sun – Thu, 9 AM – 6 PM GST' },
        { label: 'Address', value: 'Office Number 205, Malik Abdullah Ahmad Khalifa bin Hamidan al-Fulsi', sub: 'Deirah – Al-Khabisi, Dubai, UAE' },
      ],
      faqTitle: 'Frequently Asked Questions',
      faqs: [
        {
          q: 'Is this platform FTA certified?',
          a: 'Yes — the platform is built against the UAE FTA Tax Accounting Software Certification Guidelines, capturing all required VAT FAF (21 fields) and Excise FAF (32 fields) data elements.',
        },
        {
          q: 'Which invoice types are supported?',
          a: 'Tax Invoice (UBL 380), Credit Note (UBL 381), Commercial Invoice (UBL 480), and Continuous Supply invoices are all supported.',
        },
        {
          q: 'How do I connect to the FTA network?',
          a: 'The platform uses the 5-corner model. In production, you connect through a UAE-accredited ASP (Accredited Service Provider) who routes invoices to the FTA.',
        },
        {
          q: 'Can I have multiple companies?',
          a: 'Yes. The platform supports multi-company setups with isolated data and team members per company.',
        },
      ],
      resourcesTitle: 'FTA Resources',
      resourcesBody: 'Official UAE Federal Tax Authority documentation and certification guidelines.',
      resourcesLink: 'Visit tax.gov.ae',
    },
    peppol: {
      hero: {
        tag: 'E-Invoice Framework',
        title: 'The 5-Corner Model',
        body:
          "UAE's mandatory e-invoicing infrastructure is built on the E-Invoice network — a secure, standardised way to exchange electronic business documents.",
      },
      cornersTitle: 'How the 5 Corners Work',
      cornersSubtitle:
        'The UAE FTA uses the 5-corner model to route e-invoices from the supplier to the buyer through certified intermediaries.',
      corners: [
        { label: 'Supplier / ERP', tag: 'Your System', desc: 'The invoice originator. Your business creates and digitally signs the UBL 2.1 XML invoice document.' },
        { label: 'Accredited Service Provider (ASP)', tag: 'ASP / Corner 2', desc: "The supplier's ASP receives the XML, validates it against E-Invoice rules, and transmits it to the FTA network." },
        { label: 'FTA / E-Invoice Network', tag: 'FTA Network', desc: 'UAE Federal Tax Authority acts as the central hub — receiving, archiving, and routing invoices between corners.' },
        { label: 'Buyer', tag: 'Buyer / Corner 4', desc: 'The invoice recipient (business or government entity). They receive the validated e-invoice through their ASP.' },
        { label: "Buyer's ASP", tag: 'Receiving ASP', desc: "The buyer's accredited service provider delivers and archives the invoice for the receiving entity." },
      ],
      platformTitle: 'Where Our Platform Sits',
      platformBody:
        'We operate as Corner 1 — the supplier-side system that creates, validates, and packages your invoice into UBL 2.1 XML format. Our integration layer (Corner 2 ASP) handles submission to the FTA network.',
      platformCards: [
        { label: 'Corner 1', val: 'Our Platform' },
        { label: 'Corner 2', val: 'ASP Integration' },
        { label: 'Corner 5', val: 'FTA Network' },
      ],
      ublTitle: 'UBL 2.1 XML Elements Generated',
      ublSubtitle: 'Every invoice generates a fully compliant BIS Billing 3.0 XML document including:',
      ublElementHeader: 'UBL Element',
      ublDescHeader: 'Description',
      ublElements: [
        { element: 'cbc:ID', desc: 'Invoice number (auto-generated)' },
        { element: 'cbc:IssueDate', desc: 'Invoice date (YYYY-MM-DD)' },
        { element: 'cbc:InvoiceTypeCode', desc: '380 (Tax), 381 (Credit Note), 480 (Commercial)' },
        { element: 'cbc:DocumentCurrencyCode', desc: 'AED / USD / EUR' },
        { element: 'cac:AccountingSupplierParty', desc: 'Supplier — name, TRN, address' },
        { element: 'cac:AccountingCustomerParty', desc: 'Buyer — name, TRN, address' },
        { element: 'cac:TaxTotal', desc: 'Total VAT with per-category breakdown' },
        { element: 'cac:LegalMonetaryTotal', desc: 'Subtotal, taxable amount, grand total' },
        { element: 'cac:InvoiceLine', desc: 'Line items — description, qty, price, VAT' },
        { element: 'cac:InvoicePeriod', desc: 'Supply period (continuous supplies only)' },
      ],
      cta: {
        title: 'See It in Action',
        subtitle: 'Create an invoice and download the UBL XML right from the portal.',
        button: 'E-Invoice Portal',
      },
    },
    login: {
      brandSub: '5-Corner Platform',
      heroTitle: "The UAE's compliant e-invoicing platform",
      heroBody:
        'Issue, validate, and report tax invoices in full compliance with the UAE FTA mandate — powered by the BIS 3.0 standard.',
      features: [
        { title: '5-Corner', desc: 'End-to-end transmission via accredited ASP through the E-Invoice network.' },
        { title: 'ASP Validated', desc: 'Every invoice validated and digitally signed before delivery to the buyer.' },
        { title: 'Automatic FTA Reporting', desc: 'Invoice extracts reported to the Ministry of Finance data platform (Corner 5).' },
      ],
      badges: ['FTA Certified', 'BIS 3.0', 'UBL 2.1', 'VAT Compliant'],
      welcome: 'Welcome back',
      welcomeSub: 'Sign in to your account to continue',
      emailLabel: 'Email address',
      emailPh: 'you@company.ae',
      passwordLabel: 'Password',
      forgot: 'Forgot password?',
      rememberMe: 'Remember me',
      signIn: 'Sign in',
      emailRequired: 'Email is required',
      emailInvalid: 'Invalid email',
      passwordRequired: 'Password is required',
      invalidCreds: 'Invalid credentials. Please try again.',
      mfaExpiredTitle: 'MFA session expired',
      mfaExpiredBody: 'Your 24-hour authenticator session has expired. Please sign in and verify your code again.',
      unverifiedTitle: 'Email not verified',
      unverifiedBody: 'Your account is not verified. Please verify your email before accessing your account.',
      verifyNow: 'Verify email now →',
      secureNote: 'Secure JWT authentication — data encrypted in transit',
    },
    home: {
      hero: {
        titlePre: 'E-Numerak —',
        titleHighlight: 'E-Invoicing, Done Right',
        subtitle: "Navigate UAE's e-Invoicing regulations with confidence",
        body:
          'E-Numerak is an end-to-end compliance platform that centralizes invoicing across your business, giving you full control, visibility, and speed. From invoice creation to FTA Validation. Everything is unified into one intelligence system. Designed for the UAE\'s fast-growing digital Economy.',
        cta1: 'Launch E-Invoice Portal',
        cta2: 'Explore Services',
        trust: ['FTA Certified', 'BIS 3.0', 'VAT & Excise Ready', 'Secure & Compliant'],
      },
      stats: [
        { value: '5%', label: 'UAE VAT Rate' },
        { value: '32', label: 'FAF Data Elements' },
        { value: '5', label: 'E-Invoice Corners' },
        { value: '100%', label: 'FTA Compliant' },
      ],
      about: {
        tag: 'About E-Numerak',
        title: 'Revolutionizing invoicing for UAE businesses',
        p1:
          'E-Numerak is revolutionizing the way businesses in the UAE handle invoicing. With ever-changing compliance mandates, conventional approaches are falling short. Organizations require a solution that ensures compliance, maximizes efficiency, maintains security, and prepares them for what lies ahead.',
        p2:
          'Designed for the UAE, E-Numerak combines VAT, Excise and E-Invoice compliances into a single elegant platform. All of your invoices are formatted, authenticated and transmitted securely to & from the FTA, ensuring a smooth, fully compliant invoicing process. The outcome is a more intelligent, more robust online invoicing solution tailored for today\'s business.',
        cardTitle: 'E-Numerak Platform',
        cardSub: 'UAE E-Invoicing Solution',
        cardList: [
          'VAT, Excise & E-Invoice in one platform',
          'FTA-certified secure transmission',
          'Authenticated invoice formatting',
          'Fully compliant invoicing process',
          "Built for today's UAE business",
        ],
      },
      process: {
        tag: 'How It Works',
        title: 'A Seamless Process, Designed for Precision',
        p1:
          'E-Numerak delivers an end-to-end, intelligent, and paperless invoicing process. The platform seamlessly generates fully UAE-Compliant invoices. Real time validation highlights issues instantly, which enables immediate correction on the platform.',
        p2:
          'Approved invoices are then sent via the 5-corner network securely from your internal systems through the Access Point to the FTA. All steps are monitored, all information is controlled, and all documents are stored ready for a potential audit trail. A process designed not just for compliance, but to build confidence.',
        steps: [
          { label: 'Create Invoice', desc: 'Fully UAE-Compliant' },
          { label: 'Real-Time Validate', desc: 'Instant error detection' },
          { label: 'Send via E-Invoice', desc: '5-corner network' },
          { label: 'FTA Submission', desc: 'Secure & certified' },
          { label: 'Audit Trail', desc: 'Full traceability' },
        ],
      },
      services: {
        tag: 'Services',
        title: 'Comprehensive E-Invoicing Services',
        subtitle:
          'E-Numerak provides a one-stop solution to meet all requirements under the Regulations of the Country.',
        items: [
          {
            title: 'Automated E-Invoice Invoicing',
            desc:
              'The solution automatically creates E-Invoice invoices with no technical complexity. Fully FTA Audit File (FAF) compliant including all VAT and Excise data fields you need for certification.',
          },
          {
            title: 'Real-Time Validation & Tax Support',
            desc:
              'Real time validation ensures accuracy before submission. The system supports VAT and Excise for standard rated, zero rated, and exempt transactions reducing the risk of errors.',
          },
          {
            title: 'Role-Based Team Access',
            desc:
              'Role based access with the facility to distinguish the duties of each team provides stress free handling of the entire process. All features are built to make things easy without sacrificing compliance.',
          },
        ],
      },
      compliance: {
        tag: 'Compliance',
        title: 'Built for Compliance. Engineered for Excellence.',
        p1: 'E-Numerak is not only the software but also the full compliance architecture.',
        p2:
          'Compliant with all regulations of Federal Decree-Law No. 16 of 2024 (VAT) and Federal Decree-Law No. 7 of 2017 (Excise), the entire invoice processing is compliant and caters to UAE requirements. Integration with BIS Billing 3.0 for global standards, 5-corner model for end to end invoice visibility.',
        p3:
          'Security is firmly anchored in the platform and involves industry best-practices including many security measures. For example, the data isolation facility uses state-of-the-art authentication processes.',
        p4: "Compliance isn't optional — E-Numerak ensures it at every step.",
        list: [
          'Federal Decree-Law No. 16 of 2024 (VAT)',
          'Federal Decree-Law No. 7 of 2017 (Excise)',
          'FTA Tax Accounting Software Certification',
          'BIS Billing 3.0',
          'UBL 2.1 XML Standard',
          'UAE Phase 1 & Phase 2 E-Invoicing',
        ],
        cardTag: 'Complete Visibility. Total Control.',
        cardTitle: 'Every invoice moves through a clearly defined lifecycle',
        lifecycle: [
          { status: 'Draft', desc: 'Created and refined' },
          { status: 'Pending', desc: 'Ready for processing' },
          { status: 'Submitted', desc: 'Securely transmitted' },
          { status: 'Validated', desc: 'Approved by FTA' },
          { status: 'Rejected', desc: 'Immediate marking for correction' },
        ],
        cardFoot: "Stay in the loop, in the driver's seat, and always on course with standards.",
      },
      why: {
        tag: 'Why E-Numerak',
        title: 'Why Leading Businesses Choose E-Numerak',
        p1:
          "In the current fast-changing world of regulation, it's not a choice between being efficient and being accurate — it's a must.",
        p2:
          'E-Numerak enables organizations to automate complex workflows, reduce errors and accelerate invoicing. While automating the time-consuming compliance process, the solution frees your team from time-wasting admin tasks.',
        p3:
          'It is a solution for ambitious companies who prioritize accuracy, speed and adaptability to the future.',
        cards: [
          { label: 'Automate Complex Workflows', desc: 'Reduce errors and accelerate invoicing cycles across your business.' },
          { label: 'Free Your Team', desc: 'Automate time-consuming compliance tasks — no more wasted admin hours.' },
          { label: 'Built for Ambitious Companies', desc: 'A solution for organizations who prioritize accuracy, speed and adaptability.' },
        ],
      },
      value: {
        tag: 'The Big Picture',
        title: 'The Value of E-Invoicing',
        cards: [
          {
            title: 'A Transparent Ecosystem',
            body:
              'E-invoicing signifies a transition to a more transparent, efficient and secure financial ecosystem. Through the adoption of structured digital processes instead of manual procedures, enterprises ensure higher accuracy, shorter turnaround time and absolute traceability.',
          },
          {
            title: 'UAE Compliance Imperative',
            body:
              "In the UAE, this is driven by the desire for enhanced VAT compliance, lower fraud, and the shift towards global standards of digitisation. Early adoption is not a luxury — it's a necessity.",
          },
          {
            title: 'Ready Today & Tomorrow',
            body:
              'E-Numerak guarantees that your business is ready today and tomorrow for all phases of UAE e-invoicing.',
          },
        ],
      },
      cta: {
        tag: 'Get Started',
        title: 'Step Into the Future of Invoicing',
        p1:
          'The UAE is quickly progressing in adopting e-invoicing and some progressive companies have already migrated to paperless invoices.',
        p2:
          'E-Numerak offers a trusted, comprehensive platform to take that journey by combining technology, compliance, and performance. Start e-invoicing in full compliance with the FTA today.',
        button: 'Launch E-Invoice Portal',
        foot: 'Implement e-invoicing, the right way.',
      },
      tagline: {
        brand: 'E-Numerak',
        p1:
          'Built for businesses across the supply chain adopting the 5-corner e-invoicing platform for merchant establishments in UAE.',
        p2:
          "Let's build the future of the digital economy of the UAE. Certified by the FTA, with a high-technology VAT-ready platform.",
      },
    },
  },

  ar: {
    nav: {
      home: 'الرئيسية',
      about: 'من نحن',
      services: 'الخدمات',
      peppol: 'الفوترة الإلكترونية',
      contact: 'تواصل معنا',
      signIn: 'تسجيل الدخول',
      portal: 'بوابة الفوترة الإلكترونية',
      language: 'اللغة',
    },
    footer: {
      tagline:
        'حل فوترة إلكترونية متوافق مع نموذج الأطراف الخمسة لمؤسسات دولة الإمارات. معتمد من الهيئة الاتحادية للضرائب، جاهز لضريبة القيمة المضافة، ومبني لاقتصاد الإمارات الرقمي.',
      platform: 'المنصة',
      legal: 'الشؤون القانونية',
      privacy: 'سياسة الخصوصية',
      terms: 'شروط الخدمة',
      ftaCompliance: 'الامتثال للهيئة الاتحادية للضرائب',
      rights: 'E-Numerak. جميع الحقوق محفوظة.',
      certified: 'المرسوم بقانون اتحادي رقم 16 لسنة 2024 • معيار BIS 3.0 • معتمد من الهيئة الاتحادية للضرائب',
    },
    about: {
      hero: {
        tag: 'من نحن',
        title: 'مبنية لاقتصاد الإمارات الرقمي',
        body:
          'أنشأنا E-Numerak لجعل الامتثال للهيئة الاتحادية للضرائب أمراً بسيطاً — بإزالة التعقيد حتى تتمكن المؤسسات من التركيز على النمو بدلاً من المعاملات الورقية.',
      },
      valuesTitle: 'ما الذي يحرّكنا',
      values: [
        { title: 'رسالتنا', desc: 'تبسيط الامتثال للفوترة الإلكترونية في الإمارات للمؤسسات بمختلف أحجامها عبر أدوات حديثة وسهلة الاستخدام للمطوّرين.' },
        { title: 'لفِرق العمل', desc: 'وصول متعدد المستخدمين قائم على الأدوار (مدير، محاسب، مُطّلِع) ليعمل فريقك المالي بأكمله في مكان واحد.' },
        { title: 'الأمان', desc: 'مصادقة JWT، وعزل البيانات على مستوى الشركة، وسجلات تدقيق لكل إجراء على الفاتورة.' },
        { title: 'معتمدة', desc: 'مبنية وفق إرشادات اعتماد برامج المحاسبة الضريبية من الهيئة الاتحادية للضرائب لملفات تدقيق ضريبة القيمة المضافة والضريبة الانتقائية.' },
      ],
      timelineTitle: 'الجدول الزمني للضرائب والفوترة الإلكترونية في الإمارات',
      timeline: [
        { year: '2017', event: 'المرسوم بقانون اتحادي رقم 8 — استحداث ضريبة القيمة المضافة بنسبة 5%' },
        { year: '2019', event: 'تطبيق ضريبة القيمة المضافة — إلزام المؤسسات بالتسجيل' },
        { year: '2022', event: 'توسيع الضريبة الانتقائية — مشروبات الطاقة والتبغ والمشروبات الغازية' },
        { year: '2024', event: 'المرسوم بقانون اتحادي رقم 16 — إلزامية الفوترة الإلكترونية' },
        { year: '2026', event: 'انطلاق المرحلة الأولى من الفوترة الإلكترونية B2B/B2G' },
      ],
      cta: {
        title: 'ابدأ بإصدار فواتير متوافقة',
        subtitle: 'كل شيء جاهز. ما عليك سوى تسجيل الدخول وإنشاء أول فاتورة.',
        button: 'بوابة الفوترة الإلكترونية',
      },
    },
    servicesPage: {
      hero: {
        tag: 'خدماتنا',
        title: 'كل ما تحتاجه للامتثال مع E-Numerak',
        body:
          'منظومة متكاملة لإنشاء الفواتير والتحقق منها وتقديمها — تغطي جميع متطلبات الهيئة الاتحادية للضرائب دون أي تعقيد.',
      },
      cards: [
        {
          title: 'إنشاء الفواتير الضريبية',
          desc: 'أنشئ فواتير ضريبية وإشعارات دائنة وفواتير تجارية وفواتير التوريد المستمر متوافقة مع الإمارات. يُنشأ ملف UBL 2.1 XML تلقائياً عند كل حفظ.',
          tags: ['فاتورة ضريبية', 'إشعار دائن', 'تجارية', 'توريد مستمر'],
        },
        {
          title: 'ملف التدقيق الضريبي (FAF)',
          desc: 'يلتقط جميع عناصر بيانات ملف التدقيق الـ21 لضريبة القيمة المضافة والـ32 للضريبة الانتقائية المطلوبة وفق إرشادات اعتماد برامج المحاسبة الضريبية في الإمارات.',
          tags: ['FAF ضريبة القيمة المضافة', 'FAF الانتقائية', 'GL/ID', 'أرقام التصاريح', 'الاحتساب العكسي'],
        },
        {
          title: 'تحقق فوري',
          desc: 'يتم التحقق من ترويسة الفاتورة والبنود والإجماليات والرقم الضريبي ومراجع الإشعارات الدائنة قبل التقديم — مع إظهار الأخطاء فوراً.',
          tags: ['التحقق من الترويسة', 'فحص الرقم الضريبي', 'احتساب ضريبة القيمة المضافة', 'تقارير الأخطاء'],
        },
        {
          title: 'تصدير PDF و XML',
          desc: 'نزّل فواتير PDF قابلة للقراءة وملفات UBL XML قابلة للمعالجة الآلية لأي فاتورة وبأي حالة.',
          tags: ['تنزيل PDF', 'UBL XML', 'مقاس A4', 'عند الطلب'],
        },
        {
          title: 'تقارير ضريبة القيمة المضافة والانتقائية',
          desc: 'لوحة تحكم مع تفصيل ضريبة القيمة المضافة حسب نوع النسبة (5%، صفرية، معفاة، خارج النطاق). ملخص ضريبي لكل فاتورة وإجماليات الإيرادات على مستوى الشركة.',
          tags: ['ملخص الضريبة', 'الضريبة الانتقائية', 'إحصاءات اللوحة', 'إجماليات الإيرادات'],
        },
        {
          title: 'تعدد الشركات ووصول الفِرق',
          desc: 'أدِر عدة شركات ضمن حساب واحد. ادعُ أعضاء الفريق بصلاحيات دقيقة قائمة على الأدوار (مدير، محاسب، مُطّلِع).',
          tags: ['تعدد الشركات', 'حسب الأدوار', 'مدير', 'محاسب', 'مُطّلِع'],
        },
      ],
      faf: {
        title: 'تغطية حقول ملف التدقيق (FAF)',
        subtitle: 'يتم التقاط جميع الحقول المطلوبة وفق إرشادات اعتماد برامج المحاسبة الضريبية في الإمارات.',
        vatTitle: 'حقول FAF لضريبة القيمة المضافة (21)',
        vatFields: [
          'اسم الشركة', 'معرّف المستخدم', 'الرقم الضريبي (TRN)', 'مؤشّر إصدار FAF',
          'GL/ID', 'مواقع الموردين', 'الاحتساب العكسي', 'مواقع العملاء',
          'رموز الضرائب', 'أرقام الفواتير', 'تواريخ الفواتير', 'أرقام التصاريح',
          'معرّفات المعاملات', 'مبالغ مدينة', 'مبالغ دائنة',
          'مبالغ ضريبة القيمة المضافة (بالعملة الفعلية)', 'مبالغ ضريبة القيمة المضافة (بالدرهم)',
          'الذمم المدينة', 'الذمم الدائنة',
          'مراجع المنتجات/الخدمات', 'وصف السلع/الخدمات',
        ],
        exciseTitle: 'حقول FAF الإضافية للضريبة الانتقائية (11)',
        exciseFields: [
          'معرّفات المنطقة المحددة (المستودع)',
          'أرصدة المخزون الافتتاحية (عند تطبيق الضريبة الانتقائية)',
          'رموز المنتجات',
          'نسبة الضريبة الانتقائية لكل منتج',
          'أنواع المعاملات',
          'تفاصيل الحركة',
          'تواريخ المعاملات',
          'تواريخ سداد الضريبة',
          'الحالة الضريبية للمخزون',
          'تسويات المخزون (الشطب والخسائر)',
          'الموقع الفعلي للسلع',
        ],
      },
      cta: {
        title: 'جرّب المنصة',
        subtitle: 'أنشئ أول فاتورة لك في أقل من دقيقتين.',
        button: 'بوابة الفوترة الإلكترونية',
      },
    },
    contact: {
      hero: {
        tag: 'تواصل معنا',
        title: 'ابقَ على تواصل',
        body:
          'هل لديك أسئلة حول الامتثال للفوترة الإلكترونية في الإمارات، أو تكامل الفوترة الإلكترونية، أو المنصة؟ فريقنا هنا لمساعدتك.',
      },
      formTitle: 'أرسل رسالة',
      firstName: 'الاسم الأول',
      lastName: 'اسم العائلة',
      email: 'البريد الإلكتروني',
      companyTrn: 'الشركة / الرقم الضريبي (اختياري)',
      subject: 'الموضوع',
      message: 'الرسالة',
      firstNamePh: 'أحمد',
      lastNamePh: 'آل راشد',
      emailPh: 'ahmed@company.ae',
      companyPh: 'اسم الشركة أو رقم التسجيل الضريبي',
      subjectPh: 'اختر موضوعاً…',
      messagePh: 'صِف سؤالك أو متطلبك…',
      send: 'إرسال الرسالة',
      sending: 'جارٍ الإرسال…',
      sentTitle: 'تم إرسال الرسالة!',
      sentBody: 'شكراً لتواصلك معنا. سنردّ عليك خلال 24 ساعة.',
      sendAnother: 'إرسال رسالة أخرى',
      errRequired: 'يرجى تعبئة جميع الحقول المطلوبة.',
      errGeneric: 'حدث خطأ ما. يرجى المحاولة مرة أخرى أو مراسلتنا مباشرة.',
      subjects: [
        { value: 'fta_compliance', label: 'سؤال حول الامتثال للهيئة الاتحادية للضرائب' },
        { value: 'peppol', label: 'تكامل الفوترة الإلكترونية' },
        { value: 'support', label: 'دعم المنصة' },
        { value: 'pricing', label: 'الأسعار / عرض توضيحي' },
        { value: 'other', label: 'أخرى' },
      ],
      infoTitle: 'معلومات التواصل',
      items: [
        { label: 'البريد الإلكتروني', value: 'info@e-numerak.com', sub: 'نردّ خلال 24 ساعة' },
        { label: 'الهاتف', value: '+971 50 635 8421', sub: 'الأحد – الخميس، 9 صباحاً – 6 مساءً بتوقيت الخليج' },
        { label: 'العنوان', value: 'مكتب رقم 205، مالك عبدالله أحمد خليفة بن حميدان الفلاسي', sub: 'ديرة – الخبيصي، دبي، الإمارات' },
      ],
      faqTitle: 'الأسئلة الشائعة',
      faqs: [
        {
          q: 'هل هذه المنصة معتمدة من الهيئة الاتحادية للضرائب؟',
          a: 'نعم — المنصة مبنية وفق إرشادات اعتماد برامج المحاسبة الضريبية للهيئة الاتحادية للضرائب، وتلتقط جميع عناصر بيانات FAF لضريبة القيمة المضافة (21 حقلاً) والضريبة الانتقائية (32 حقلاً) المطلوبة.',
        },
        {
          q: 'ما أنواع الفواتير المدعومة؟',
          a: 'الفاتورة الضريبية (UBL 380)، والإشعار الدائن (UBL 381)، والفاتورة التجارية (UBL 480)، وفواتير التوريد المستمر — جميعها مدعومة.',
        },
        {
          q: 'كيف أتصل بشبكة الهيئة الاتحادية للضرائب؟',
          a: 'تستخدم المنصة نموذج الأطراف الخمسة. في بيئة الإنتاج، تتصل عبر مزوّد خدمة معتمد في الإمارات (ASP) يقوم بتوجيه الفواتير إلى الهيئة الاتحادية للضرائب.',
        },
        {
          q: 'هل يمكنني إدارة عدة شركات؟',
          a: 'نعم. تدعم المنصة إعدادات متعددة الشركات مع عزل البيانات وأعضاء فريق لكل شركة.',
        },
      ],
      resourcesTitle: 'مصادر الهيئة الاتحادية للضرائب',
      resourcesBody: 'الوثائق الرسمية وإرشادات الاعتماد الصادرة عن الهيئة الاتحادية للضرائب في الإمارات.',
      resourcesLink: 'زيارة tax.gov.ae',
    },
    peppol: {
      hero: {
        tag: 'إطار الفوترة الإلكترونية',
        title: 'نموذج الأطراف الخمسة',
        body:
          'بُنيت البنية التحتية الإلزامية للفوترة الإلكترونية في الإمارات على شبكة الفوترة الإلكترونية — وهي طريقة آمنة وموحّدة لتبادل المستندات التجارية الإلكترونية.',
      },
      cornersTitle: 'كيف تعمل الأطراف الخمسة',
      cornersSubtitle:
        'تستخدم الهيئة الاتحادية للضرائب نموذج الأطراف الخمسة لتوجيه الفواتير الإلكترونية من المورّد إلى المشتري عبر وسطاء معتمدين.',
      corners: [
        { label: 'المورّد / نظام تخطيط الموارد', tag: 'نظامك', desc: 'منشئ الفاتورة. تقوم مؤسستك بإنشاء مستند فاتورة UBL 2.1 XML وتوقيعه رقمياً.' },
        { label: 'مزوّد الخدمة المعتمد (ASP)', tag: 'ASP / الطرف 2', desc: 'يستقبل مزوّد خدمة المورّد ملف XML، ويتحقق منه وفق قواعد الفوترة الإلكترونية، ثم يرسله إلى شبكة الهيئة الاتحادية للضرائب.' },
        { label: 'الهيئة الاتحادية للضرائب / الشبكة', tag: 'شبكة الهيئة', desc: 'تعمل الهيئة الاتحادية للضرائب كمركز رئيسي — تستقبل الفواتير وتؤرشفها وتوجّهها بين الأطراف.' },
        { label: 'المشتري', tag: 'المشتري / الطرف 4', desc: 'مستلم الفاتورة (جهة تجارية أو حكومية). يستلم الفاتورة الإلكترونية المعتمدة عبر مزوّد خدمته.' },
        { label: 'مزوّد خدمة المشتري', tag: 'مزوّد الاستلام', desc: 'يقوم مزوّد الخدمة المعتمد للمشتري بتسليم الفاتورة وأرشفتها للجهة المستلمة.' },
      ],
      platformTitle: 'موقع منصتنا في النموذج',
      platformBody:
        'نعمل كـ الطرف 1 — النظام من جهة المورّد الذي ينشئ فاتورتك ويتحقق منها ويعبّئها بصيغة UBL 2.1 XML. وتتولى طبقة التكامل لدينا (مزوّد الطرف 2) إرسالها إلى شبكة الهيئة الاتحادية للضرائب.',
      platformCards: [
        { label: 'الطرف 1', val: 'منصتنا' },
        { label: 'الطرف 2', val: 'تكامل مزوّد الخدمة' },
        { label: 'الطرف 5', val: 'شبكة الهيئة' },
      ],
      ublTitle: 'عناصر UBL 2.1 XML المُنشأة',
      ublSubtitle: 'تُنشئ كل فاتورة مستند XML متوافقاً بالكامل مع معيار BIS Billing 3.0 ويشمل:',
      ublElementHeader: 'عنصر UBL',
      ublDescHeader: 'الوصف',
      ublElements: [
        { element: 'cbc:ID', desc: 'رقم الفاتورة (يُنشأ تلقائياً)' },
        { element: 'cbc:IssueDate', desc: 'تاريخ الفاتورة (سنة-شهر-يوم)' },
        { element: 'cbc:InvoiceTypeCode', desc: '380 (ضريبية)، 381 (إشعار دائن)، 480 (تجارية)' },
        { element: 'cbc:DocumentCurrencyCode', desc: 'درهم / دولار / يورو' },
        { element: 'cac:AccountingSupplierParty', desc: 'المورّد — الاسم، الرقم الضريبي، العنوان' },
        { element: 'cac:AccountingCustomerParty', desc: 'المشتري — الاسم، الرقم الضريبي، العنوان' },
        { element: 'cac:TaxTotal', desc: 'إجمالي ضريبة القيمة المضافة مع التفصيل حسب الفئة' },
        { element: 'cac:LegalMonetaryTotal', desc: 'المجموع الفرعي، المبلغ الخاضع للضريبة، الإجمالي الكلي' },
        { element: 'cac:InvoiceLine', desc: 'بنود الفاتورة — الوصف، الكمية، السعر، الضريبة' },
        { element: 'cac:InvoicePeriod', desc: 'فترة التوريد (لعمليات التوريد المستمر فقط)' },
      ],
      cta: {
        title: 'شاهدها أثناء العمل',
        subtitle: 'أنشئ فاتورة ونزّل ملف UBL XML مباشرة من البوابة.',
        button: 'بوابة الفوترة الإلكترونية',
      },
    },
    login: {
      brandSub: 'منصة الأطراف الخمسة',
      heroTitle: 'منصة الفوترة الإلكترونية المتوافقة في الإمارات',
      heroBody:
        'أصدِر الفواتير الضريبية وتحقق منها وأبلِغ عنها بامتثال كامل لتفويض الهيئة الاتحادية للضرائب — مدعومة بمعيار BIS 3.0.',
      features: [
        { title: 'الأطراف الخمسة', desc: 'إرسال متكامل عبر مزوّد خدمة معتمد من خلال شبكة الفوترة الإلكترونية.' },
        { title: 'تحقق مزوّد الخدمة', desc: 'يتم التحقق من كل فاتورة وتوقيعها رقمياً قبل تسليمها إلى المشتري.' },
        { title: 'إبلاغ تلقائي للهيئة', desc: 'تُبلَّغ مستخلصات الفواتير إلى منصة بيانات وزارة المالية (الطرف 5).' },
      ],
      badges: ['معتمد من الهيئة', 'BIS 3.0', 'UBL 2.1', 'متوافق مع ضريبة القيمة المضافة'],
      welcome: 'مرحباً بعودتك',
      welcomeSub: 'سجّل الدخول إلى حسابك للمتابعة',
      emailLabel: 'البريد الإلكتروني',
      emailPh: 'you@company.ae',
      passwordLabel: 'كلمة المرور',
      forgot: 'هل نسيت كلمة المرور؟',
      rememberMe: 'تذكّرني',
      signIn: 'تسجيل الدخول',
      emailRequired: 'البريد الإلكتروني مطلوب',
      emailInvalid: 'بريد إلكتروني غير صالح',
      passwordRequired: 'كلمة المرور مطلوبة',
      invalidCreds: 'بيانات الاعتماد غير صحيحة. يرجى المحاولة مرة أخرى.',
      mfaExpiredTitle: 'انتهت جلسة المصادقة الثنائية',
      mfaExpiredBody: 'انتهت جلسة المصادقة لمدة 24 ساعة. يرجى تسجيل الدخول والتحقق من الرمز مرة أخرى.',
      unverifiedTitle: 'البريد الإلكتروني غير مُفعّل',
      unverifiedBody: 'حسابك غير مُفعّل. يرجى تفعيل بريدك الإلكتروني قبل الوصول إلى حسابك.',
      verifyNow: 'فعّل البريد الإلكتروني الآن ←',
      secureNote: 'مصادقة JWT آمنة — البيانات مشفّرة أثناء النقل',
    },
    home: {
      hero: {
        titlePre: '— E-Numerak',
        titleHighlight: 'الفوترة الإلكترونية بالشكل الصحيح',
        subtitle: 'تعامَل مع أنظمة الفوترة الإلكترونية في الإمارات بثقة تامة',
        body:
          'E-Numerak منصة امتثال متكاملة تجمع عمليات الفوترة في مؤسستك في مكان واحد، لتمنحك تحكماً كاملاً ووضوحاً وسرعة. من إنشاء الفاتورة وحتى اعتمادها لدى الهيئة الاتحادية للضرائب — كل شيء موحَّد في نظام ذكي واحد، مصمَّم لاقتصاد الإمارات الرقمي سريع النمو.',
        cta1: 'افتح بوابة الفوترة الإلكترونية',
        cta2: 'استكشف الخدمات',
        trust: ['معتمد من الهيئة الاتحادية للضرائب', 'معيار BIS 3.0', 'جاهز لضريبة القيمة المضافة والانتقائية', 'آمن ومتوافق'],
      },
      stats: [
        { value: '5%', label: 'نسبة ضريبة القيمة المضافة في الإمارات' },
        { value: '32', label: 'عناصر بيانات ملف التدقيق (FAF)' },
        { value: '5', label: 'أطراف الفوترة الإلكترونية' },
        { value: '100%', label: 'متوافق مع الهيئة الاتحادية للضرائب' },
      ],
      about: {
        tag: 'عن E-Numerak',
        title: 'ثورة في الفوترة لمؤسسات دولة الإمارات',
        p1:
          'تُحدث E-Numerak نقلة نوعية في طريقة تعامل المؤسسات في الإمارات مع الفوترة. ومع التغيّر المستمر في متطلبات الامتثال، لم تعد الأساليب التقليدية كافية. تحتاج المؤسسات إلى حلٍّ يضمن الامتثال، ويرفع الكفاءة، ويحافظ على الأمان، ويهيّئها لمتطلبات المستقبل.',
        p2:
          'صُممت E-Numerak خصيصاً لدولة الإمارات، فتجمع متطلبات ضريبة القيمة المضافة والضريبة الانتقائية والفوترة الإلكترونية في منصة واحدة أنيقة. تُنسَّق جميع فواتيرك وتُوثَّق وتُرسَل بأمان من وإلى الهيئة الاتحادية للضرائب، لضمان عملية فوترة سلسة ومتوافقة بالكامل. والنتيجة حلٌّ أذكى وأقوى للفوترة عبر الإنترنت يناسب أعمال اليوم.',
        cardTitle: 'منصة E-Numerak',
        cardSub: 'حل الفوترة الإلكترونية في الإمارات',
        cardList: [
          'ضريبة القيمة المضافة والانتقائية والفوترة الإلكترونية في منصة واحدة',
          'إرسال آمن معتمد من الهيئة الاتحادية للضرائب',
          'تنسيق موثّق للفواتير',
          'عملية فوترة متوافقة بالكامل',
          'مبنية لأعمال الإمارات اليوم',
        ],
      },
      process: {
        tag: 'كيف تعمل',
        title: 'عملية سلسة مصممة بدقة',
        p1:
          'توفّر E-Numerak عملية فوترة متكاملة وذكية وخالية من الورق. تُنشئ المنصة فواتير متوافقة بالكامل مع أنظمة الإمارات، ويُبرز التحقق الفوري أي مشكلات على الفور، ما يتيح تصحيحها مباشرة على المنصة.',
        p2:
          'تُرسَل الفواتير المعتمدة عبر شبكة الأطراف الخمسة بأمان من أنظمتك الداخلية ومن خلال نقطة الوصول إلى الهيئة الاتحادية للضرائب. تُراقَب جميع الخطوات، وتُضبط كل المعلومات، وتُحفظ جميع المستندات جاهزة لأي تدقيق محتمل. عملية مصممة ليس للامتثال فحسب، بل لبناء الثقة.',
        steps: [
          { label: 'إنشاء الفاتورة', desc: 'متوافقة بالكامل مع الإمارات' },
          { label: 'تحقق فوري', desc: 'كشف الأخطاء لحظياً' },
          { label: 'الإرسال عبر الفوترة الإلكترونية', desc: 'شبكة الأطراف الخمسة' },
          { label: 'التقديم للهيئة', desc: 'آمن ومعتمد' },
          { label: 'سجل التدقيق', desc: 'إمكانية تتبّع كاملة' },
        ],
      },
      services: {
        tag: 'الخدمات',
        title: 'خدمات فوترة إلكترونية شاملة',
        subtitle: 'توفّر E-Numerak حلاً متكاملاً يلبي جميع المتطلبات وفق أنظمة الدولة.',
        items: [
          {
            title: 'فوترة إلكترونية آلية',
            desc:
              'ينشئ الحل الفواتير الإلكترونية تلقائياً دون أي تعقيد تقني. متوافق بالكامل مع ملف التدقيق الضريبي (FAF) ويشمل جميع حقول بيانات ضريبة القيمة المضافة والانتقائية التي تحتاجها للاعتماد.',
          },
          {
            title: 'تحقق فوري ودعم ضريبي',
            desc:
              'يضمن التحقق الفوري الدقة قبل التقديم. يدعم النظام ضريبة القيمة المضافة والانتقائية للمعاملات بالنسبة القياسية وصفرية النسبة والمعفاة، ما يقلل من احتمالية الأخطاء.',
          },
          {
            title: 'صلاحيات وصول حسب الأدوار',
            desc:
              'تتيح الصلاحيات المبنية على الأدوار تمييز مهام كل فريق، ما يوفّر إدارة سلسة للعملية بأكملها. صُممت جميع الميزات لتسهيل العمل دون التفريط في الامتثال.',
          },
        ],
      },
      compliance: {
        tag: 'الامتثال',
        title: 'مبنية للامتثال. مهندسة للتميّز.',
        p1: 'E-Numerak ليست مجرد برنامج، بل منظومة امتثال متكاملة.',
        p2:
          'متوافقة مع جميع أحكام المرسوم بقانون اتحادي رقم 16 لسنة 2024 (ضريبة القيمة المضافة) والمرسوم بقانون اتحادي رقم 7 لسنة 2017 (الضريبة الانتقائية)، فتكون معالجة الفواتير بأكملها متوافقة وتلبي متطلبات الإمارات. التكامل مع معيار BIS Billing 3.0 للمعايير العالمية، ونموذج الأطراف الخمسة لرؤية شاملة للفواتير من البداية إلى النهاية.',
        p3:
          'الأمان راسخ في صميم المنصة ويعتمد أفضل ممارسات القطاع مع تدابير حماية متعددة. على سبيل المثال، يستخدم نظام عزل البيانات أحدث آليات المصادقة.',
        p4: 'الامتثال ليس اختيارياً — وE-Numerak تضمنه في كل خطوة.',
        list: [
          'المرسوم بقانون اتحادي رقم 16 لسنة 2024 (ضريبة القيمة المضافة)',
          'المرسوم بقانون اتحادي رقم 7 لسنة 2017 (الضريبة الانتقائية)',
          'اعتماد برامج المحاسبة الضريبية من الهيئة الاتحادية للضرائب',
          'معيار BIS Billing 3.0',
          'معيار UBL 2.1 XML',
          'الفوترة الإلكترونية في الإمارات — المرحلتان الأولى والثانية',
        ],
        cardTag: 'رؤية كاملة. تحكّم تام.',
        cardTitle: 'تمرّ كل فاتورة عبر دورة حياة محددة بوضوح',
        lifecycle: [
          { status: 'مسودة', desc: 'تم إنشاؤها وتحسينها' },
          { status: 'قيد الانتظار', desc: 'جاهزة للمعالجة' },
          { status: 'تم الإرسال', desc: 'أُرسلت بأمان' },
          { status: 'تم الاعتماد', desc: 'معتمدة من الهيئة' },
          { status: 'مرفوضة', desc: 'تمييز فوري للتصحيح' },
        ],
        cardFoot: 'ابقَ على اطلاع دائم، وفي موضع التحكم، ومتوافقاً مع المعايير دوماً.',
      },
      why: {
        tag: 'لماذا E-Numerak',
        title: 'لماذا تختار الشركات الرائدة E-Numerak',
        p1:
          'في عالم التنظيمات سريع التغيّر اليوم، لم يعد الأمر اختياراً بين الكفاءة والدقة — بل كلاهما ضرورة.',
        p2:
          'تمكّن E-Numerak المؤسسات من أتمتة سير العمل المعقّد وتقليل الأخطاء وتسريع الفوترة. ومع أتمتة عملية الامتثال المستهلكة للوقت، يتحرر فريقك من المهام الإدارية المهدِرة للوقت.',
        p3: 'إنه حلٌّ للشركات الطموحة التي تضع الدقة والسرعة والقدرة على التكيّف مع المستقبل في المقدمة.',
        cards: [
          { label: 'أتمتة سير العمل المعقّد', desc: 'قلّل الأخطاء وسرّع دورات الفوترة في مؤسستك.' },
          { label: 'حرّر فريقك', desc: 'أتمتة مهام الامتثال المستهلكة للوقت — لا مزيد من الساعات الإدارية المهدرة.' },
          { label: 'مبنية للشركات الطموحة', desc: 'حلٌّ للمؤسسات التي تعطي الأولوية للدقة والسرعة والمرونة.' },
        ],
      },
      value: {
        tag: 'الصورة الكبرى',
        title: 'قيمة الفوترة الإلكترونية',
        cards: [
          {
            title: 'منظومة شفافة',
            body:
              'تمثّل الفوترة الإلكترونية انتقالاً إلى منظومة مالية أكثر شفافية وكفاءة وأماناً. فمن خلال اعتماد عمليات رقمية منظّمة بدلاً من الإجراءات اليدوية، تضمن المؤسسات دقة أعلى ووقت إنجاز أقصر وتتبّعاً كاملاً.',
          },
          {
            title: 'ضرورة الامتثال في الإمارات',
            body:
              'في الإمارات، يدفع ذلك الرغبةُ في تعزيز الامتثال لضريبة القيمة المضافة، وخفض الاحتيال، والتحول نحو المعايير العالمية للرقمنة. التبنّي المبكر ليس رفاهية — بل ضرورة.',
          },
          {
            title: 'جاهزة اليوم وغداً',
            body: 'تضمن E-Numerak أن تكون أعمالك جاهزة اليوم وغداً لجميع مراحل الفوترة الإلكترونية في الإمارات.',
          },
        ],
      },
      cta: {
        tag: 'ابدأ الآن',
        title: 'ادخل إلى مستقبل الفوترة',
        p1:
          'تتقدم الإمارات بسرعة في تبنّي الفوترة الإلكترونية، وقد انتقلت بعض الشركات الرائدة بالفعل إلى الفواتير غير الورقية.',
        p2:
          'تقدّم E-Numerak منصة موثوقة وشاملة لخوض هذه الرحلة من خلال الجمع بين التقنية والامتثال والأداء. ابدأ الفوترة الإلكترونية بامتثال كامل للهيئة الاتحادية للضرائب اليوم.',
        button: 'افتح بوابة الفوترة الإلكترونية',
        foot: 'طبّق الفوترة الإلكترونية بالطريقة الصحيحة.',
      },
      tagline: {
        brand: 'E-Numerak',
        p1:
          'مبنية للمؤسسات عبر سلسلة التوريد التي تعتمد منصة الفوترة الإلكترونية بنموذج الأطراف الخمسة للمنشآت التجارية في الإمارات.',
        p2:
          'لنبنِ معاً مستقبل الاقتصاد الرقمي لدولة الإمارات. معتمدة من الهيئة الاتحادية للضرائب، بمنصة عالية التقنية جاهزة لضريبة القيمة المضافة.',
      },
    },
  },
} as const;
