import { useState } from 'react';
import { ChevronLeft, User, Building2, CreditCard, Hash, Phone, MapPin, ShieldCheck, CheckCircle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auth';

interface Props {
  onBack: () => void;
  onAdded: () => void;
}

interface FormState {
  holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  contact_number: string;
  account_address: string;
}

const FIELDS: {
  label: string; key: keyof FormState; placeholder: string;
  icon: React.ElementType; required: boolean; upper?: boolean; type?: string; hint?: string;
}[] = [
  { label: 'Account Holder Name', key: 'holder_name', placeholder: 'Full name on account', icon: User, required: true },
  { label: 'Bank Name', key: 'bank_name', placeholder: 'e.g. State Bank of India', icon: Building2, required: true },
  { label: 'Account Number', key: 'account_number', placeholder: 'Enter account number', icon: CreditCard, required: true },
  { label: 'IFSC Code', key: 'ifsc_code', placeholder: 'e.g. SBIN0001234', icon: Hash, required: true, upper: true, hint: 'Find on your cheque book' },
  { label: 'Contact Number', key: 'contact_number', placeholder: 'Linked mobile number', icon: Phone, required: false, type: 'tel' },
  { label: 'Account Address', key: 'account_address', placeholder: 'Branch address', icon: MapPin, required: false },
];

export default function AddBankScreen({ onBack, onAdded }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>({
    holder_name: '', bank_name: '', account_number: '',
    ifsc_code: '', contact_number: '', account_address: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    const required: (keyof FormState)[] = ['holder_name', 'bank_name', 'account_number', 'ifsc_code'];
    if (required.some(k => !form[k].trim())) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const docRef = await addDoc(collection(db, 'bank_accounts'), {
        user_id: user!.id,
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        ifsc_code: form.ifsc_code.trim().toUpperCase(),
        holder_name: form.holder_name.trim(),
        contact_number: form.contact_number.trim(),
        account_address: form.account_address.trim(),
        is_active: true,
        created_at: serverTimestamp(),
      });
      await logActivity('user', user!.id, user!.displayId, 'bank_account_added', 'bank_account', docRef.id, form.account_number);
      setLoading(false);
      setSuccess(true);
      setTimeout(onAdded, 1200);
    } catch {
      setError('Failed to add account. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center px-8 text-center gap-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle size={40} className="text-green-500" strokeWidth={1.8} />
        </div>
        <h2 className="text-2xl font-black text-gray-900">Account Added!</h2>
        <p className="text-gray-400 text-sm">Your bank account has been saved successfully.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] shrink-0">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 active:scale-95 transition-transform">
          <ChevronLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-lg font-black text-gray-900">Add Bank Account</h1>
          <p className="text-xs text-gray-400">Fill in your bank details below</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-10">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5 flex items-start gap-2">
            <span className="text-red-400 mt-0.5">!</span>
            {error}
          </div>
        )}

        <div className="space-y-4">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                {f.label}
                {f.required && <span className="text-red-400 ml-1">*</span>}
                {f.hint && <span className="text-gray-400 font-normal ml-1.5 text-xs">({f.hint})</span>}
              </label>
              <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-4 py-3.5 gap-3 focus-within:border-yellow-400 focus-within:shadow-[0_0_0_3px_rgba(251,191,36,0.12)] transition-all shadow-sm">
                <f.icon size={17} className="text-gray-400 shrink-0" strokeWidth={1.8} />
                <input
                  type={f.type || 'text'}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => set(f.key, f.upper ? e.target.value.toUpperCase() : e.target.value)}
                  className="flex-1 bg-transparent text-gray-900 text-sm outline-none placeholder-gray-400"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4 mt-6 mb-6">
          <ShieldCheck size={18} className="text-amber-500 shrink-0 mt-0.5" strokeWidth={1.8} />
          <p className="text-xs text-gray-600 leading-relaxed">
            Your bank details are <strong>encrypted and secure</strong>. We never store your banking passwords or OTPs.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-yellow-400 text-gray-900 font-black py-4 rounded-2xl text-base active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg shadow-yellow-200"
        >
          {loading ? 'Adding Account...' : 'Add Bank Account'}
        </button>
      </div>
    </div>
  );
}
