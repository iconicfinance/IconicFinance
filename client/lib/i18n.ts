// ── Number normalization ──────────────────────────────────────────────────────
// Converts Arabic-Indic (٠١٢٣٤٥٦٧٨٩) and Extended Arabic-Indic (۰۱۲۳۴۵۶۷۸۹)
// digits to Western digits so DB always stores/searches in Western format.
export const normalizeNumbers = (str: string): string =>
  str
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

// ── Month names ───────────────────────────────────────────────────────────────
export const MONTH_NAMES_AR = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];

// ── Arabic (Egyptian) translations ────────────────────────────────────────────
export const ar: Record<string, string> = {
  // ── Navigation
  'Dashboard': 'لوحة التحكم',
  'Doctors': 'الأطباء',
  'Users': 'المستخدمون',
  'Patients': 'المرضى',
  'Monthly Closing': 'الإغلاق الشهري',
  'Lab Config': 'إعدادات المعامل',
  'Today': 'اليوم',
  'Add Payment': 'إضافة دفعة',
  'Add Expense': 'إضافة مصروف',
  'History': 'السجل',
  'Logout': 'تسجيل الخروج',
  'Closing': 'الإغلاق',
  'Labs': 'المعامل',
  'Payment': 'دفعة',
  'Expense': 'مصروف',

  // ── Auth
  'Clinic Finance Management System': 'نظام إدارة مالية العيادة',
  'Username': 'اسم المستخدم',
  'Password': 'كلمة السر',
  'Enter your username': 'أدخل اسم المستخدم',
  'Enter your password': 'أدخل كلمة السر',
  'Sign In': 'دخول',
  'Signing in...': 'جاري الدخول...',
  'Login failed. Please try again.': 'فشل الدخول. يرجى المحاولة مجدداً.',

  // ── Common actions
  'Cancel': 'إلغاء',
  'Save': 'حفظ',
  'Save Changes': 'حفظ التغييرات',
  'Confirm': 'تأكيد',
  'Delete': 'حذف',
  'Edit': 'تعديل',
  'Add': 'إضافة',
  'Search': 'بحث',
  'Load': 'تحميل',
  'Loading...': 'جاري التحميل...',
  'Loading': 'جاري التحميل',
  'Back': 'رجوع',
  'Close': 'إغلاق',
  'Refresh': 'تحديث',
  'Saving...': 'جاري الحفظ...',
  'Creating...': 'جاري الإنشاء...',
  'Printing...': 'جاري الطباعة...',
  'Done': 'تم',

  // ── Common states
  'Active': 'نشط',
  'Inactive': 'غير نشط',
  'Activate': 'تفعيل',
  'Deactivate': 'إيقاف',
  'Settled': 'مسدد',
  'Outstanding': 'مستحق',
  'Pending': 'معلق',
  'Confirmed': 'مؤكد',

  // ── Common messages
  'No results': 'لا توجد نتائج',
  'No data found': 'لا توجد بيانات',
  'Something went wrong': 'حدث خطأ',
  'The app encountered an unexpected error. Please reload.': 'حدث خطأ غير متوقع. يرجى إعادة التشغيل.',
  'Reload App': 'إعادة تشغيل التطبيق',
  'Failed to load': 'فشل التحميل',
  'No transactions found.': 'لا توجد معاملات.',

  // ── Roles
  'admin': 'مشرف',
  'doctor': 'طبيب',
  'assistant': 'مساعد',
  'Admin': 'مشرف',
  'Doctor': 'طبيب',
  'Assistant': 'مساعد',
  'Primary': 'أساسي',
  'Extern': 'خارجي',
  'Custom': 'مخصص',
  'Extern (40%)': 'خارجي (40%)',

  // ── Payment methods
  'Cash': 'نقداً',
  'Vodafone Cash': 'فودافون كاش',
  'Instapay': 'إنستاباي',

  // ── Patient
  'Patient': 'المريض',
  'New Patient': 'مريض جديد',
  'Create new patient': 'إنشاء مريض جديد',
  'No results — create new patient': 'لا توجد نتائج — إنشاء مريض جديد',
  'Cancel — search instead': 'إلغاء — البحث بدلاً من ذلك',
  'Patient name and code are required.': 'اسم المريض والكود مطلوبان.',
  'Please select or create a patient.': 'يرجى اختيار أو إنشاء مريض.',
  'Patient Full Name *': 'الاسم الكامل للمريض *',
  'Patient Code (e.g. P-0042) *': 'كود المريض (مثال: P-0042) *',
  'Full name *': 'الاسم الكامل *',
  'Patient code (e.g. P-0042) *': 'كود المريض (مثال: P-0042) *',
  'Search by name or patient code...': 'ابحث بالاسم أو كود المريض...',
  'Search by name or code...': 'ابحث بالاسم أو الكود...',
  'Search patient by name or code...': 'ابحث عن مريض بالاسم أو الكود...',
  'Search all patients by name or code...': 'ابحث في كل المرضى بالاسم أو الكود...',
  'Search by patient name or code...': 'ابحث باسم المريض أو الكود...',
  'Patient Detail': 'تفاصيل المريض',
  'Total Visits': 'إجمالي الزيارات',
  'Total Paid': 'إجمالي المدفوع',
  'No transactions found for this patient.': 'لا توجد معاملات لهذا المريض.',
  'My Patients': 'مرضاي',
  'No patients found.': 'لا يوجد مرضى.',

  // ── Doctor
  'Select a doctor': 'اختر طبيباً',
  'Please select a doctor.': 'يرجى اختيار طبيب.',
  'Doctor Management': 'إدارة الأطباء',
  'Add Doctor': 'إضافة طبيب',
  'All Doctors': 'جميع الأطباء',
  'Doctor name': 'اسم الطبيب',
  'Failed to save doctor': 'فشل حفظ بيانات الطبيب',

  // ── Payment form
  'Record a new patient payment': 'تسجيل دفعة مريض جديدة',
  'Payment Details': 'تفاصيل الدفعة',
  'Payment Method': 'طريقة الدفع',
  'Please select a payment method.': 'يرجى اختيار طريقة الدفع.',
  'Select payment method': 'اختر طريقة الدفع',
  'Total Clinical (EGP)': 'إجمالي العلاج (ج.م)',
  'Pay Today (EGP) *': 'الدفع اليوم (ج.م) *',
  'Pay Today': 'الدفع اليوم',
  'Total Clinical': 'إجمالي العلاج',
  'Total Due Today': 'المستحق اليوم',
  'Patient pays +1% =': 'المريض يدفع +1% =',
  'Net to clinic:': 'صافي العيادة:',
  'Vodafone fee (1%)': 'رسوم فودافون (1%)',
  '1% fee is charged to patient, not deducted from their balance.': 'رسوم الـ1% تُحمَّل على المريض ولا تُخصم من رصيده.',
  'Remaining after payment': 'المتبقي بعد الدفع',
  'Fully paid ✓': 'مدفوع بالكامل ✓',
  'Please enter a valid amount to pay.': 'يرجى إدخال مبلغ صحيح للدفع.',
  'Please enter a valid amount.': 'يرجى إدخال مبلغ صحيح.',
  'Payment Recorded!': 'تم تسجيل الدفعة!',
  'Balance Recorded!': 'تم تسجيل الرصيد!',
  'Visit Noted!': 'تم تسجيل الزيارة!',
  'Leave 0 if not paying today': 'اترك 0 إذا لم يكن هناك دفع اليوم',
  'No payment today — balance total will be updated if changed.': 'لا دفع اليوم — سيتم تحديث إجمالي الرصيد إن تغير.',
  'No payment today — balance of': 'لا دفع اليوم — رصيد',
  'will be recorded as outstanding.': 'سيتم تسجيله كمستحق.',
  'Please enter a payment amount or change the total.': 'يرجى إدخال مبلغ دفع أو تغيير الإجمالي.',
  'Please enter a payment amount or set a total clinical amount.': 'يرجى إدخال مبلغ دفع أو تحديد إجمالي العلاج.',
  'Please enter a total clinical amount or a payment.': 'يرجى إدخال إجمالي العلاج أو مبلغ الدفع.',
  'is required.': 'مطلوب.',
  'Visit Noted': 'تم تسجيل الزيارة',
  'Extern / Custom Closing': 'إغلاق الخارجيين والمخصصين',
  'Monthly closing for extern and custom doctors': 'الإغلاق الشهري للأطباء الخارجيين والمخصصين',
  'Assistant Closing': 'إغلاق المساعد',
  'My Closings': 'إغلاقاتي',
  'No extern or custom doctors found for this month.': 'لا يوجد أطباء خارجيون أو مخصصون لهذا الشهر.',
  'Redirecting...': 'جاري التحويل...',
  'Confirm Payment': 'تأكيد الدفعة',
  'Failed to record payment.': 'فشل تسجيل الدفعة.',
  'Enter the full treatment cost. If patient pays less today, the difference is tracked as a remaining balance.':
    'أدخل تكلفة العلاج الكاملة. إذا دفع المريض أقل اليوم، سيتم تتبع الفارق كرصيد متبقٍ.',
  'Notes (optional)': 'ملاحظات (اختياري)',
  'Any notes about this visit...': 'أي ملاحظات عن هذه الزيارة...',

  // ── Balance
  'Outstanding Balance': 'رصيد مستحق',
  'Outstanding Balances': 'الأرصدة المستحقة',
  'Remaining': 'المتبقي',
  'Total Due': 'إجمالي المستحق',
  'Paid so far': 'المدفوع حتى الآن',
  'Change total': 'تغيير الإجمالي',
  'Change Total': 'تغيير الإجمالي',
  'Apply this payment toward the balance': 'احتساب هذه الدفعة من الرصيد',
  'Checking balance...': 'جاري التحقق من الرصيد...',
  'No outstanding balances.': 'لا توجد أرصدة مستحقة.',
  'Patients with Balance': 'مرضى برصيد مستحق',
  'Total Outstanding': 'إجمالي المستحق',
  'No balance': 'لا يوجد رصيد',
  'remaining': 'متبقٍ',
  'Payment Balance': 'رصيد الدفعات',
  'of': 'من',
  'Search all patients or view outstanding balances': 'ابحث في جميع المرضى أو اعرض الأرصدة المستحقة',
  'Outstanding balances and patient search': 'الأرصدة المستحقة والبحث عن المرضى',

  // ── Timeline events
  'Balance created': 'تم إنشاء الرصيد',
  'Total updated': 'تم تحديث الإجمالي',
  'Payment': 'دفعة',

  // ── Expense form
  'Record a clinic expense': 'تسجيل مصروف عيادة',
  'Expense Details': 'تفاصيل المصروف',
  'What was this expense for?': 'ما الغرض من هذا المصروف؟',
  'Description is required.': 'الوصف مطلوب.',
  'Expense Recorded!': 'تم تسجيل المصروف!',
  'Failed to record expense.': 'فشل تسجيل المصروف.',
  'Record Expense': 'تسجيل المصروف',
  'Amount (EGP) *': 'المبلغ (ج.م) *',
  'Description *': 'الوصف *',
  'Description (optional)': 'وصف (اختياري)',

  // ── Lab fees
  'Lab fees included?': 'هل تتضمن رسوم معمل؟',
  'Add another lab': 'إضافة معمل آخر',
  'Select lab': 'اختر المعمل',
  'Total lab fees:': 'إجمالي رسوم المعامل:',
  'Lab Configuration': 'إعدادات المعامل',
  'Define the labs used in patient transactions': 'تحديد المعامل المستخدمة في معاملات المرضى',
  'Add Lab': 'إضافة معمل',
  'Edit Lab': 'تعديل المعمل',
  'Lab name (e.g. Central Lab, BioLab)': 'اسم المعمل (مثال: معمل مركزي، بيولاب)',
  'No labs added yet. Add one to start tracking lab fees by lab.': 'لم تتم إضافة معامل بعد.',
  'Delete Lab': 'حذف المعمل',
  'Delete': 'حذف',
  'Lab name is required.': 'اسم المعمل مطلوب.',
  'Failed to save lab': 'فشل حفظ المعمل',
  'Failed to delete lab. It may be in use by existing transactions.': 'فشل حذف المعمل. قد يكون مستخدماً في معاملات موجودة.',
  'Lab Fees': 'رسوم المعامل',
  'Lab Fees by Lab': 'رسوم المعامل حسب المعمل',
  'This will fail if the lab has existing fee records.': 'سيفشل هذا إذا كان للمعمل سجلات رسوم موجودة.',

  // ── Today page
  "Today's Transactions": 'معاملات اليوم',
  'Expenses': 'المصروفات',
  'No transactions yet today.': 'لا توجد معاملات اليوم بعد.',
  'Time': 'الوقت',

  // ── History
  'Transaction History': 'سجل المعاملات',
  'From': 'من',
  'To': 'إلى',
  'No transactions found for this period.': 'لا توجد معاملات لهذه الفترة.',
  'Filter': 'تصفية',

  // ── Monthly Closing
  'End-of-month financial settlement': 'التسوية المالية الشهرية',
  'Month': 'الشهر',
  'Year': 'السنة',
  'Clinic Summary': 'ملخص العيادة',
  'Total Revenue': 'إجمالي الإيرادات',
  'Total Expenses': 'إجمالي المصروفات',
  'Total Salaries': 'إجمالي المرتبات',
  'Extern / Custom Cut': 'حصة الخارجيين',
  'Clinic Remaining': 'صافي العيادة',
  'Primary Share': 'حصة الأساسي',
  'doctors': 'أطباء',
  'Per-Doctor Closings': 'الإغلاق حسب الطبيب',
  'Cases': 'حالات',
  'Gross Earnings': 'الأرباح الإجمالية',
  'Amount to Pay (EGP)': 'المبلغ للدفع (ج.م)',
  'Comment (optional)': 'تعليق (اختياري)',
  'Admin note...': 'ملاحظة المشرف...',
  'Confirm & Lock': 'تأكيد وقفل',
  'Reopen': 'إعادة فتح',
  'Print / PDF': 'طباعة / PDF',
  'Monthly Salaries': 'المرتبات الشهرية',
  'Person Name *': 'اسم الشخص *',
  'e.g. Reception staff': 'مثال: موظف استقبال',
  'Add Salary': 'إضافة مرتب',
  'No salaries recorded for this month yet.': 'لم يتم تسجيل مرتبات لهذا الشهر بعد.',
  'No data for this month. Click Load to fetch.': 'لا توجد بيانات. اضغط تحميل.',
  'Total': 'الإجمالي',

  // ── Admin Dashboard
  'All Transactions': 'جميع المعاملات',
  'Add Transaction': 'إضافة معاملة',
  'Date': 'التاريخ',
  'Date & Time': 'التاريخ والوقت',
  'Method': 'الطريقة',
  'Base': 'الأساسي',
  'Final': 'الإجمالي',
  'Recorded By': 'مسجل بواسطة',
  'Notes': 'ملاحظات',
  'Type': 'النوع',
  'Payment In': 'دفعة واردة',
  'Expense Out': 'مصروف صادر',
  'Total Dr. Earnings': 'إجمالي أرباح الطبيب',
  'Payment History': 'سجل الدفعات',

  // ── Users
  'User Management': 'إدارة المستخدمين',
  'Add User': 'إضافة مستخدم',
  'All Users': 'جميع المستخدمين',
  'Name': 'الاسم',
  'Role': 'الدور',
  'Status': 'الحالة',
  'Actions': 'الإجراءات',
  'Create User': 'إنشاء مستخدم',
  'Full name': 'الاسم الكامل',
  'Username (login)': 'اسم المستخدم (للدخول)',
  'Linked Doctor': 'الطبيب المرتبط',
  '— No linked doctor —': '— بدون طبيب مرتبط —',

  // ── Search results
  'Search Results': 'نتائج البحث',
  'patients': 'مرضى',
  'Search for a patient above to view their history.': 'ابحث عن مريض أعلاه لعرض سجله.',
  'My Earnings': 'أرباحي',

  // ── Months
  'January': 'يناير', 'February': 'فبراير', 'March': 'مارس',
  'April': 'أبريل', 'May': 'مايو', 'June': 'يونيو',
  'July': 'يوليو', 'August': 'أغسطس', 'September': 'سبتمبر',
  'October': 'أكتوبر', 'November': 'نوفمبر', 'December': 'ديسمبر',

  // ── Common search/input placeholders
  'Search...': 'ابحث...',
  'Search by name or code...': 'ابحث بالاسم أو الكود...',
  'Any notes...': 'أي ملاحظات...',
  'Amount': 'المبلغ',
  'Amount (EGP)': 'المبلغ (ج.م)',
  '0.00': '0.00',

  // ── Table headers
  'Date / Time': 'التاريخ / الوقت',
  'Patient Code': 'كود المريض',
  'Amount Paid': 'المبلغ المدفوع',
  'Remaining Balance': 'الرصيد المتبقي',
  'Dr. Earnings': 'أرباح الطبيب',

  // ── Add/Edit Transaction Modal
  'Edit Transaction': 'تعديل المعاملة',
  'Add Transaction': 'إضافة معاملة',
  'Date & Time *': 'التاريخ والوقت *',
  'Type *': 'النوع *',
  'Select type': 'اختر النوع',
  'Select doctor': 'اختر الطبيب',
  'Select method': 'اختر الطريقة',
  'Base Amount (EGP) *': 'المبلغ الأساسي (ج.م) *',
  'Description *': 'الوصف *',
  'What was this expense for?': 'ما الغرض من هذا المصروف؟',
  'Notes (optional)': 'ملاحظات (اختياري)',
  'Any notes...': 'أي ملاحظات...',

  // ── History page
  'Show': 'عرض',
  'days': 'أيام',
  'Last 7 days': 'آخر 7 أيام',
  'Last 30 days': 'آخر 30 يوم',
  'Last 90 days': 'آخر 90 يوم',
  'Total': 'الإجمالي',
  'Revenue': 'الإيرادات',

  // ── Today page
  'Add Payment': 'إضافة دفعة',
  'Add Expense': 'إضافة مصروف',
  "Today's Summary": 'ملخص اليوم',
  'No transactions recorded today yet.': 'لا توجد معاملات اليوم بعد.',
  'Pending Lab Fees': 'رسوم معامل معلقة',

  // ── Doctor Dashboard
  'My Dashboard': 'لوحتي',
  'My Earnings': 'أرباحي',
  'My Cases': 'حالاتي',
  'Total Revenue': 'إجمالي الإيرادات',

  // ── Monthly closing month selector
  'January': 'يناير', 'February': 'فبراير', 'March': 'مارس',
  'April': 'أبريل', 'May': 'مايو', 'June': 'يونيو',
  'July': 'يوليو', 'August': 'أغسطس', 'September': 'سبتمبر',
  'October': 'أكتوبر', 'November': 'نوفمبر', 'December': 'ديسمبر',

  // ── Language toggle
  'العربية': 'English',
  'English': 'العربية',
};

export type Lang = 'en' | 'ar';

export const translate = (key: string, lang: Lang): string => {
  if (lang === 'en') return key;
  return ar[key] ?? key;
};
