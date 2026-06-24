import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/Icon.jsx';

const DEMO_ACCOUNTS = [
  { label: 'Dealer Manager Demo', email: 'dealer@pricerpoint.ai', password: 'dealer123', color: '#f75d34' },
];

function Field({ label, type = 'text', value, onChange, icon, placeholder, hint }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="auth-field">
      <label className="auth-label">{label}</label>
      <div className="auth-input-wrap">
        <span className="auth-input-icon"><Icon name={icon} size={16} color="#aaa" strokeWidth={1.8} /></span>
        <input
          className="auth-input"
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={isPassword ? 'current-password' : type === 'email' ? 'email' : 'off'}
        />
        {isPassword && (
          <button className="auth-eye-btn" type="button" onClick={() => setShow(s => !s)}>
            <Icon name="eye" size={15} color="#aaa" strokeWidth={1.8} />
          </button>
        )}
      </div>
      {hint && <div className="auth-hint">{hint}</div>}
    </div>
  );
}

function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    setError('');
    await new Promise(r => setTimeout(r, 500));
    const result = login({ email, password });
    if (!result.ok) setError(result.error);
    setLoading(false);
  };

  const fillDemo = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <Field label="Email Address" type="email" icon="person" value={email} onChange={setEmail} placeholder="you@example.com" />
      <Field label="Password" type="password" icon="lock" value={password} onChange={setPassword} placeholder="Enter your password" />

      {error && <div className="auth-error-box"><Icon name="warning" size={14} color="#e02020" strokeWidth={2} />{error}</div>}

      <button className="auth-submit-btn" type="submit" disabled={loading}>
        {loading ? <span className="cd-spinner" /> : <Icon name="arrowRight" size={16} color="white" strokeWidth={2.2} />}
        {loading ? 'Signing in…' : 'Sign In'}
      </button>

      <div className="auth-divider"><span>or try the demo account</span></div>
      <div className="demo-accounts">
        {DEMO_ACCOUNTS.map(acc => (
          <button key={acc.email} type="button" className="demo-account-btn" style={{ '--demo-color': acc.color }} onClick={() => fillDemo(acc)}>
            <span className="demo-role-dot" style={{ background: acc.color }} />{acc.label}
          </button>
        ))}
      </div>

      <div className="auth-switch-row">Don't have an account?<button type="button" className="auth-switch-link" onClick={onSwitch}>Sign Up</button></div>
    </form>
  );
}

function SignupForm({ onSwitch }) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) { setError('Please fill in all fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setError('');
    await new Promise(r => setTimeout(r, 600));
    const result = signup({ name, email, password });
    if (!result.ok) setError(result.error);
    setLoading(false);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <Field label="Full Name" type="text" icon="person" value={name} onChange={setName} placeholder="e.g. Rahul Verma" />
      <Field label="Email Address" type="email" icon="search" value={email} onChange={setEmail} placeholder="you@example.com" />
      <Field label="Password" type="password" icon="lock" value={password} onChange={setPassword} placeholder="Min. 6 characters" hint="Account type: Dealer / Seller" />

      {error && <div className="auth-error-box"><Icon name="warning" size={14} color="#e02020" strokeWidth={2} />{error}</div>}

      <button className="auth-submit-btn" type="submit" disabled={loading}>
        {loading ? <span className="cd-spinner" /> : <Icon name="check" size={16} color="white" strokeWidth={2.2} />}
        {loading ? 'Creating account…' : 'Create Account'}
      </button>

      <div className="auth-switch-row">Already have an account?<button type="button" className="auth-switch-link" onClick={onSwitch}>Sign In</button></div>
    </form>
  );
}

export default function AuthScreen() {
  const [tab, setTab] = useState('login');
  return (
    <div className="auth-root">
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <div className="auth-hero-brand">
            <div className="auth-hero-logo"><Icon name="car" size={28} color="#f75d34" strokeWidth={2} /></div>
            <div className="auth-hero-wordmark">Pricer<span className="auth-hero-ai">Point</span></div>
          </div>
          <div className="auth-hero-tagline">ML-Powered Vehicle Valuation & Seller Quote Platform</div>
          <div className="auth-hero-pills">
            <span className="auth-hero-pill"><Icon name="robot" size={12} color="#f75d34" strokeWidth={2} /> CatBoost ML</span>
            <span className="auth-hero-pill"><Icon name="shield" size={12} color="#f75d34" strokeWidth={2} /> Risk Aware</span>
            <span className="auth-hero-pill"><Icon name="trendUp" size={12} color="#f75d34" strokeWidth={2} /> Smart Quotes</span>
          </div>
        </div>
        <div className="auth-hero-car-strip">
          <img src="/cars/honda_city.png" alt="" className="auth-strip-car c1" />
          <img src="/cars/hyundai_creta.png" alt="" className="auth-strip-car c2" />
          <img src="/cars/toyota_fortuner.png" alt="" className="auth-strip-car c3" />
        </div>
      </div>

      <div className="auth-card-wrap">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
            <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => setTab('signup')}>Sign Up</button>
          </div>
          <div className="auth-tab-content" key={tab}>{tab === 'login' ? <LoginForm onSwitch={() => setTab('signup')} /> : <SignupForm onSwitch={() => setTab('login')} />}</div>
        </div>
        <div className="auth-footer">Demo login: <strong>dealer@pricerpoint.ai</strong> / <strong>dealer123</strong></div>
      </div>
    </div>
  );
}
