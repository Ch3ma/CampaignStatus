import { HandoutArchive } from './handouts/view';
import { useEffect, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { accessState, type Membership } from './domain';
import { auth, getCellName, isDemo, watchMembership } from './firebase';
import { ArchiveList, Dashboard, Notice } from './archive';
import { Handler } from './handler';

const nav = [
  { to: '/', mark: '▦', label: 'Panel de control' },
  { to: '/expedientes', mark: '▤', label: 'Expedientes' },
  { to: '/personal', mark: '◎', label: 'Personal' },
  { to: '/evidencias', mark: '◇', label: 'Evidencias' },
  { to: '/comunicaciones', mark: '▱', label: 'Comunicaciones' },
];

function Brand() {
  return <span className="brand"><span className="insignia" aria-hidden="true"><i /></span>
    <span>BLACK<strong> ARCHIVE</strong></span></span>;
}

function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logIn(email: string, password: string) {
    if (!auth) return;
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('No se pudo iniciar sesión. Verifica tus datos y la conexión.');
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void logIn(String(data.get('email')).trim(), String(data.get('password')));
  }
  return <main className="login-shell">
    <section className="login-card"><Brand />
      <div className="login-intro"><p className="eyebrow">Acceso restringido</p><h1>Identificación</h1>
        <p>Ingresa con la cuenta asignada por tu Handler.</p></div>
      <form onSubmit={submit}>
        <label>Correo electrónico<input required name="email" type="email" autoComplete="username" /></label>
        <label>Contraseña<input required name="password" type="password" autoComplete="current-password" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Verificando…' : 'Iniciar sesión'}</button>
      </form>
      {isDemo && <div className="demo-access"><p className="eyebrow">Demostración local · datos ficticios</p>
        <button disabled={busy} onClick={() => void logIn('agent@example.test', 'archive-demo-agent')}>Entrar como agente</button>
        <button disabled={busy} onClick={() => void logIn('handler@example.test', 'archive-demo-handler')}>Entrar como Handler</button></div>}
    </section>
  </main>;
}

function Session({ user }: { user: User }) {
  const [membership, setMembership] = useState<Membership | null>();
  const [error, setError] = useState(false);
  const [exitError, setExitError] = useState(false);
  const [cellName, setCellName] = useState('Cell A');
  useEffect(() => watchMembership(user.uid, setMembership, () => setError(true)), [user.uid]);
  useEffect(() => {
    if (membership) void getCellName().then(setCellName).catch(() => {});
  }, [membership]);
  function closeSession() {
    if (auth) void signOut(auth).catch(() => setExitError(true));
  }
  const logout = <button type="button" className="logout" onClick={closeSession}>Cerrar sesión</button>;
  const exitNotice = exitError && <p role="alert" className="error">No se pudo cerrar sesión. Vuelve a intentarlo.</p>;
  const access = accessState(membership !== undefined, user.uid, membership ?? null);
  if (error) return <main className="gate"><Notice error>No se pudo comprobar tu acceso.</Notice>{logout}{exitNotice}</main>;
  if (access === 'loading') return <main className="gate"><Notice>Verificando acceso a la célula…</Notice>{logout}{exitNotice}</main>;
  if (!membership) return <main className="gate"><Notice>Tu cuenta necesita una membresía activa en {cellName}.</Notice>{logout}{exitNotice}</main>;
  const session = { uid: user.uid, role: membership.role };

  return <div className="shell" key={membership.role}>
    <a className="skip" href="#main-content">Saltar al contenido</a>
    <aside className="rail">
      <Link to="/" className="brand-link" aria-label="BLACK ARCHIVE, inicio"><Brand /></Link>
      <div className="cell-label"><span className="dot" />{cellName}</div>
      <nav aria-label="Secciones del archivo">
        {nav.map(({ to, mark, label }) => <NavLink key={to} to={to} end={to === '/'}>
          <span className="nav-symbol" aria-hidden="true">{mark}</span>{label}</NavLink>)}
        {session.role === 'handler' && <NavLink to="/handler">
          <span className="nav-symbol" aria-hidden="true">⚙</span>Panel del Handler</NavLink>}
      </nav>
      <div className="rail-end"><strong>{membership.alias}</strong>
        <span>{session.role === 'handler' ? 'Handler' : 'Agente de célula'}</span>{logout}{exitNotice}</div>
    </aside>
    <div className="workspace">
      <header className="topline"><span>ARCHIVO OPERATIVO <span className="divider">/</span> {cellName}</span>
        {isDemo && <span className="demo-label">DEMOSTRACIÓN LOCAL</span>}</header>
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Dashboard session={session} cellName={cellName} />} />
          <Route path="/expedientes/:recordId?" element={<ArchiveList key="dossiers" section="dossiers" base="/expedientes" session={session} />} />
          <Route path="/personal/:recordId?" element={<ArchiveList key="personnel" section="personnel" base="/personal" session={session} />} />
          <Route path="/handouts/:handoutId?" element={<HandoutArchive />} />
          <Route path="/evidencias/:recordId?" element={<ArchiveList key="clues" section="clues" base="/evidencias" session={session} />} />
          <Route path="/comunicaciones/:recordId?" element={<ArchiveList key="messages" section="messages" base="/comunicaciones" session={session} />} />
          {session.role === 'handler' && <Route path="/handler" element={<Handler session={session} />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  </div>;
}

export function App() {
  const [user, setUser] = useState<User | null>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (auth) return onAuthStateChanged(auth, setUser, () => setError(true));
  }, []);
  if (!auth || error) return <main className="gate"><Notice error>
    Firebase no está disponible. Revisa la configuración indicada en el README.
  </Notice></main>;
  if (user === undefined) return <main className="gate"><Notice>Iniciando BLACK ARCHIVE…</Notice></main>;
  return user ? <Session key={user.uid} user={user} /> : <SignIn />;
}
