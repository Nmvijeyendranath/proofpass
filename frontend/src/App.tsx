import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  Activity, ArrowUpRight, BadgeCheck, BookOpen, Check, ChevronRight, Fingerprint,
  CircleAlert, Clipboard, KeyRound, LayoutDashboard, LockKeyhole,
  Menu, Network, RotateCcw, ShieldCheck, Sparkles, WalletCards, X,
  FileText, UploadCloud, Loader2, ExternalLink, Target, RefreshCw, Clock, ListChecks
} from 'lucide-react'
import { api, demoMode } from './api'
import { calculateAccuracy } from './accuracy'
import type { Gap, PassportData, ProofDecision, Recommendation, RoadmapItem, WorkflowPhase } from './types'

const navItems = [
  { to: '/guide', label: 'How to use', icon: BookOpen },
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/journey', label: 'ProofPass journey', icon: Activity },
  { to: '/wallet', label: 'Wallet & credentials', icon: WalletCards },
  { to: '/insights', label: 'Skill insights', icon: Sparkles },
  { to: '/roadmap', label: 'Learning roadmap', icon: BookOpen },
  { to: '/sharing', label: 'Proof sharing', icon: ShieldCheck },
  { to: '/employer', label: 'Recruiter portal', icon: BadgeCheck },
]

const pageMeta: Record<string, { title: string; description: string }> = {
  '/': { title: 'Student overview', description: 'Review a simulated skill passport, sample credentials, and a privacy-first proof request.' },
  '/dashboard': { title: 'Student overview', description: 'Review a simulated skill passport, sample credentials, and a privacy-first proof request.' },
  '/guide': { title: 'How to use ProofPass', description: 'A short guide to exploring the student-facing ProofPass demo and its limits.' },
  '/journey': { title: 'ProofPass journey', description: 'Explore the 9-step demo flow from decentralized identity to a portable skill proof.' },
  '/wallet': { title: 'Wallet & credentials', description: 'Inspect sample credentials and claims in the ProofPass demo wallet.' },
  '/insights': { title: 'Skill insights', description: 'See illustrative skill mapping, role suggestions, and learning gaps.' },
  '/roadmap': { title: 'Learning roadmap', description: 'Track sample milestones in the ProofPass frontend demo.' },
  '/sharing': { title: 'Proof sharing', description: 'Review and decide on a simulated claim-level employer request.' },
  '/employer': { title: 'Recruiter portal', description: 'Review a fictional claim request in the separate simulated ProofPass recruiter portal.' },
  '/about': { title: 'About ProofPass', description: 'Learn what ProofPass is designed to do and what this frontend demo does not implement.' },
  '/privacy': { title: 'Privacy', description: 'Understand what sample data this ProofPass demo uses and what it does not collect.' },
  '/terms': { title: 'Terms of this demo', description: 'Read the limitations that apply to the simulated ProofPass frontend.' },
  '/contact': { title: 'Contact', description: 'Contact information and support availability for the ProofPass demo.' },
}

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname)
  useEffect(() => {
    const update = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  return pathname.replace(/\/+$/, '') || '/'
}

function RouteLink({ to, children, className, onNavigate, ...props }: {
  to: string
  children: ReactNode
  className?: string
  onNavigate?: () => void
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children' | 'className' | 'onClick'>) {
  return <a href={to} className={className} {...props} onClick={(event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    if (window.location.pathname !== to) window.history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo({ top: 0 })
    onNavigate?.()
  }}>{children}</a>
}

function App() {
  const pathname = usePathname()
  const [data, setData] = useState<PassportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')

  const loadPassport = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try { setData(await api.getPassport()) }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Passport data could not be loaded.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadPassport() }, [loadPassport])

  // Poll for passport updates (new proof requests, roadmap changes) every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      api.getPassport().then((fresh) => {
        if (fresh) setData(fresh)
      }).catch(() => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const meta = pageMeta[pathname] ?? { title: 'Page not found', description: 'This ProofPass page does not exist.' }
    document.title = `${meta.title} · ProofPass`
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${meta.title} · ProofPass`)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', meta.description)
  }, [pathname])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3600)
    return () => window.clearTimeout(timer)
  }, [notice])

  const currentTitle = pageMeta[pathname]?.title ?? 'Page not found'
  const activeNav = pathname === '/dashboard' ? '/' : pathname
  const isKnownRoute = pathname in pageMeta || pathname === '/dashboard'
  const requiresData = ['/', '/dashboard', '/journey', '/wallet', '/insights', '/roadmap', '/sharing', '/employer'].includes(pathname)

  let content: ReactNode
  if (!isKnownRoute) content = <NotFoundPage />
  else if (requiresData && loading) content = <LoadingState />
  else if (requiresData && loadError) content = <ErrorState message={loadError} onRetry={() => void loadPassport()} />
  else {
    switch (pathname) {
      case '/': case '/dashboard': content = data ? <OverviewPage data={data} /> : <LoadingState />; break
      case '/journey': content = data ? <JourneyPage data={data} /> : <LoadingState />; break
      case '/wallet': content = data ? <WalletPage data={data} onCopy={() => setNotice('Sample holder identifier copied.')} onReload={() => void loadPassport()} /> : <LoadingState />; break
      case '/insights': content = data ? <InsightsPage data={data} /> : <LoadingState />; break
      case '/roadmap': content = data ? <RoadmapPage data={data} setData={setData} onReload={() => void loadPassport()} /> : <LoadingState />; break
      case '/sharing': content = data ? <SharingPage data={data} setData={setData} onNotice={setNotice} /> : <LoadingState />; break
      case '/employer': content = data ? <EmployerPage data={data} /> : <LoadingState />; break
      case '/guide': content = <GuidePage />; break
      case '/about': content = <AboutPage />; break
      case '/privacy': content = <PrivacyPage />; break
      case '/terms': content = <TermsPage />; break
      case '/contact': content = <ContactPage />; break
      default: content = <NotFoundPage />
    }
  }

  return <AppShell activePath={activeNav} title={currentTitle} holderDid={data?.holder.did} hasPendingRequest={data?.proofRequest?.status === 'pending'} notice={notice} onDismissNotice={() => setNotice('')}>
    {content}
  </AppShell>
}

function AppShell({ activePath, title, holderDid, hasPendingRequest, notice, onDismissNotice, children }: {
  activePath: string; title: string; holderDid?: string; hasPendingRequest?: boolean; notice: string; onDismissNotice: () => void; children: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const copyDid = async () => {
    if (!holderDid) return
    try {
      await navigator.clipboard?.writeText(holderDid)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { /* Clipboard access is optional; no private data is sent. */ }
  }
  return <div className="app-shell">
    {menuOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
      <RouteLink to="/" className="brand" onNavigate={() => setMenuOpen(false)}>
        <span className="brand-mark" aria-hidden="true"><BrandGlyph tone="light" /></span>
        <span className="brand-copy"><strong>ProofPass</strong><small>portable skill passport</small></span>
      </RouteLink>
      <div className="demo-label">Demonstration workspace</div>
      <nav className="primary-nav" aria-label="Primary">
        {navItems.map(({ to, label, icon: Icon }) => <RouteLink key={to} to={to} className={`nav-item ${activePath === to ? 'active' : ''}`} aria-current={activePath === to ? 'page' : undefined} onNavigate={() => setMenuOpen(false)}>
          <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{to === '/sharing' && hasPendingRequest && <em aria-label="One pending request">1</em>}
        </RouteLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><LockKeyhole size={15} /><span>Choose a claim to share. Sample credentials stay in this demo.</span></div>
        <div className="secondary-nav">
          <RouteLink to="/about" className={`nav-item small-nav ${activePath === '/about' ? 'active' : ''}`} onNavigate={() => setMenuOpen(false)}><Network size={16} /><span>About ProofPass</span></RouteLink>
        </div>
        <div className="sidebar-foot"><span>Frontend demo · no live integrations</span></div>
      </div>
    </aside>
    <main className="main-content" id="main-content">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen}><Menu size={21} /></button>
        <div className="breadcrumbs"><span>ProofPass</span><ChevronRight size={14} /><strong>{title}</strong></div>
        <div className="top-actions"><RouteLink to="/guide" className="guide-top-link" onNavigate={() => setMenuOpen(false)}><BookOpen size={14} /> How to use</RouteLink><span className="demo-status">Demo mode</span>

          <div className="account-control" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAccountOpen(false)
          }}>
            <button className="avatar" type="button" aria-label="Open sample account menu" aria-haspopup="menu" aria-expanded={accountOpen} aria-controls="account-menu" onClick={() => setAccountOpen((open) => !open)}>AM</button>
            {accountOpen && <div className="account-menu" id="account-menu" role="menu" aria-label="Sample account">
              <div className="account-menu-profile"><span className="account-menu-initials">AM</span><span><strong>Aarav Mehta</strong><small>Sample student account</small></span></div>
              <p className="account-menu-note">Demo profile only. No sign-in or account records are connected.</p>
              <RouteLink to="/guide" role="menuitem" onNavigate={() => { setAccountOpen(false); setMenuOpen(false) }}><BookOpen size={15} />How to use ProofPass</RouteLink>
              <RouteLink to="/wallet" role="menuitem" onNavigate={() => { setAccountOpen(false); setMenuOpen(false) }}><WalletCards size={15} />Wallet & credentials</RouteLink>
              <RouteLink to="/privacy" role="menuitem" onNavigate={() => { setAccountOpen(false); setMenuOpen(false) }}><LockKeyhole size={15} />Privacy details</RouteLink>
            </div>}
          </div>
        </div>
      </header>
      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={onDismissNotice} aria-label="Dismiss notice"><X size={15} /></button></div>}
      {demoMode && <div className="demo-ribbon"><CircleAlert size={14} /><span>Sample data only. No real AI, credential verification, wallet, zkTLS, or blockchain is connected.</span><RouteLink to="/about">What this means <ArrowUpRight size={13} /></RouteLink></div>}
      {children}
      <footer className="site-footer"><span>ProofPass · frontend demonstration</span><nav aria-label="Legal and contact"><RouteLink to="/privacy">Privacy</RouteLink><RouteLink to="/terms">Terms</RouteLink><RouteLink to="/contact">Contact</RouteLink></nav></footer>
    </main>
  </div>
}

function PageIntro({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: ReactNode }) {
  return <section className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{copy && <p className="intro-copy">{copy}</p>}</div>{action}</section>
}
function PanelHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="panel-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}</div>
}
function PageWrap({ children }: { children: ReactNode }) { return <div className="page-wrap">{children}</div> }
function DemoTag({ children = 'Sample' }: { children?: ReactNode }) { return <span className="demo-tag">{children}</span> }
function EmptyState({ title, copy }: { title: string; copy: string }) { return <div className="empty-state"><div className="empty-icon"><CircleAlert size={19} /></div><strong>{title}</strong><p>{copy}</p></div> }
function BrandGlyph({ tone }: { tone: 'light' | 'dark' }) {
  return <svg className={`brand-glyph ${tone === 'light' ? 'brand-glyph-light' : 'brand-glyph-dark'}`} viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="14" fill="#13231f" />
    <path d="M18 34.5 27.5 44 47 21" fill="none" stroke="#b7f36b" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m17 22 8 8 8-8" fill="none" stroke="#f7f3ea" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
function AccuracyMeter({ snapshot, compact = false }: { snapshot: ReturnType<typeof calculateAccuracy>; compact?: boolean }) {
  const sourceLabel = snapshot.source === 'verified' ? 'verified credential claims' : snapshot.source === 'mixed' ? 'verified and simulated claims' : snapshot.source === 'simulated' ? 'simulated sample claims' : 'no eligible credential claims'
  return <section className={`accuracy-meter-card ${compact ? 'compact' : ''}`} aria-labelledby={compact ? 'accuracy-title-compact' : 'accuracy-title'}>
    <div className="accuracy-head"><div><p className="eyebrow">Profile-to-evidence match</p><h2 id={compact ? 'accuracy-title-compact' : 'accuracy-title'}>Accuracy meter</h2></div><strong className="accuracy-value">{snapshot.totalSkills ? `${snapshot.percentage}%` : '—'}</strong></div>
    <div className="accuracy-progress" role="meter" aria-label="Profile skills with an exact credential-claim match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={snapshot.percentage} aria-valuetext={`${snapshot.matchedSkills} of ${snapshot.totalSkills} listed skills matched`}><span style={{ width: `${snapshot.percentage}%` }} /></div>
    <p className="accuracy-summary"><strong>{snapshot.matchedSkills} of {snapshot.totalSkills}</strong> listed skills match a credential claim exactly.</p>
    <details className="accuracy-details"><summary>How it is calculated</summary><p>Unique skill names are normalized for case and spacing, then matched exactly against claims in verified or simulated credentials. The percentage is matched skills ÷ all listed skills.</p></details>
    <p className="accuracy-disclaimer">Based on {sourceLabel}. Sample data is simulated; this is not a real-world AI/model accuracy score or a live verification result.</p>
  </section>
}
function LoadingState() { return <PageWrap><div className="loading-card" role="status"><span className="loading-mark"><Check size={18} /></span><strong>Loading the sample passport…</strong><span>Only bundled demo data is used in mock mode.</span></div></PageWrap> }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <PageWrap><div className="error-card" role="alert"><CircleAlert size={20} /><div><strong>Passport data could not be loaded.</strong><p>{message}</p><button className="outline-button" onClick={onRetry}><RotateCcw size={15} /> Try again</button></div></div></PageWrap>
}

function OverviewPage({ data }: { data: PassportData }) {
  const pending = data.proofRequest?.status === 'pending'
  const accuracy = calculateAccuracy(data)
  return <PageWrap>
    <section className="guide-banner"><div><p className="eyebrow">New to ProofPass?</p><h2>Start with the quick guide.</h2><p>See what is sample, what you can explore, and how claim sharing works.</p></div><RouteLink to="/guide" className="primary-button">How to use <ArrowUpRight size={15} /></RouteLink></section>
    <PageIntro eyebrow={`Student workspace · ${data.holder.name}`} title="Share a claim, not a transcript." copy="A sample skill passport that makes the requested proof visible before anything is shared." action={<RouteLink to="/sharing" className="outline-button"><ShieldCheck size={16} /> Review sample request {pending && <span className="count-badge">1</span>}</RouteLink>} />
    <section className="hero-card">
      <div className="hero-copy"><div className="hero-kicker">Student passport · simulated</div><h2>Evidence without the archive.</h2><p>Explore how a student could share one verified claim while keeping the original credential details private. Every person, claim, and status on this screen is sample data.</p>
        <div className="hero-actions"><RouteLink to="/journey" className="primary-button">Explore the 9-step flow <ArrowUpRight size={16} /></RouteLink><RouteLink to="/wallet" className="text-button">Open sample wallet <ChevronRight size={15} /></RouteLink></div>
      </div><div className="hero-visual" aria-hidden="true"><div className="orbital orbital-one" /><div className="orbital orbital-two" /><div className="passport-chip"><Fingerprint size={22} strokeWidth={1.7} /><span>9</span><small>steps mapped</small></div><div className="proof-stamp"><ShieldCheck size={13} /><span>claim-only proof</span></div></div>
    </section>
    <div className="overview-accuracy"><AccuracyMeter snapshot={accuracy} /></div>
    <div className="section-heading"><div><p className="eyebrow">Student view</p><h2>Your demo workspace</h2></div><span className="micro-note"><LockKeyhole size={14} /> fictional sample data · no real credentials connected</span></div>
    <section className="summary-grid" aria-label="Sample workspace summary">
      <article className="summary-card"><span className="summary-icon green"><BadgeCheck size={16} /></span><div><strong>Sample credentials</strong><small>Academic and skill examples</small></div><RouteLink to="/wallet" aria-label="View sample credentials"><ArrowUpRight size={15} /></RouteLink></article>
      <article className="summary-card"><span className="summary-icon yellow"><Sparkles size={16} /></span><div><strong>Illustrative skill profile</strong><small>Static sample recommendations</small></div><RouteLink to="/insights" aria-label="View sample skill insights"><ArrowUpRight size={15} /></RouteLink></article>
      <article className="summary-card"><span className="summary-icon blue"><BookOpen size={16} /></span><div><strong>Learning roadmap</strong><small>Editable demo milestones</small></div><RouteLink to="/roadmap" aria-label="View sample roadmap"><ArrowUpRight size={15} /></RouteLink></article>
    </section>
    <section className="content-grid">
      <div className="panel journey-panel"><PanelHeader eyebrow="From source to selective proof" title="The ProofPass journey" action={<RouteLink to="/journey" className="inline-link">View all 9 steps <ArrowUpRight size={14} /></RouteLink>} />
        <div className="mini-timeline">{data.workflow.slice(0, 6).map((phase) => <RouteLink key={phase.id} to="/journey" className="mini-phase"><PhaseMarker phase={phase} /><span><strong>{phase.title}</strong><small>{phase.description}</small></span></RouteLink>)}</div>
        <div className="timeline-more"><span>Sample flow · 9 steps</span><RouteLink to="/journey">Open journey <ArrowUpRight size={14} /></RouteLink></div>
      </div>
      <div className="panel request-panel"><PanelHeader eyebrow="Consent before disclosure" title="Sample proof request" />
        {data.proofRequest ? <><div className="request-from"><div className="company-avatar">N</div><div><strong>{data.proofRequest.from}</strong><span>{data.proofRequest.role}</span></div><DemoTag>{data.proofRequest.status}</DemoTag></div><div className="claim-box"><span>Sample claim requested</span><strong>“{data.proofRequest.requestedClaim}”</strong><small>This demo explains selective disclosure. It does not send a proof.</small></div><RouteLink to="/sharing" className="dark-button full">Review share choices <ChevronRight size={16} /></RouteLink></> : <EmptyState title="No sample requests" copy="A sample proof request will appear here when the data includes one." />}
      </div>
    </section>
    <section className="passport-strip"><div className="passport-title"><span className="brand-mark inverted" aria-hidden="true"><BrandGlyph tone="dark" /></span><div><p className="eyebrow">Portable skill passport</p><h3>Built for the claim, not the archive.</h3></div></div><div className="passport-meta"><span><KeyRound size={14} /> {data.holder.did}</span><span><Network size={14} /> {data.holder.network}</span></div><RouteLink to="/guide" className="outline-button light">How to use this demo <ArrowUpRight size={15} /></RouteLink></section>
  </PageWrap>
}

function PhaseMarker({ phase }: { phase: WorkflowPhase }) {
  return <span className={`phase-marker ${phase.state}`}>{phase.state === 'complete' ? <Check size={13} /> : phase.id}</span>
}

function JourneyPage({ data }: { data: PassportData }) {
  const [selectedId, setSelectedId] = useState(7)
  const selected = useMemo(() => data.workflow.find((phase) => phase.id === selectedId) ?? data.workflow[0], [data.workflow, selectedId])
  return <PageWrap><PageIntro eyebrow="9 steps · one portable record" title="The ProofPass journey." copy="Follow the concept from identity setup through a claim-only sharing result. Statuses shown here describe a demo, not live processing." />
    <div className="journey-view"><div className="panel workflow-list" aria-label="ProofPass workflow phases">{data.workflow.map((phase) => <button key={phase.id} className={`workflow-step ${selectedId === phase.id ? 'selected' : ''}`} onClick={() => setSelectedId(phase.id)} aria-pressed={selectedId === phase.id}><PhaseMarker phase={phase} /><span><strong><span className="phase-number">{String(phase.id).padStart(2, '0')}</span> {phase.title}</strong><small>{phase.description}</small></span><span className="step-badge">{phase.state === 'complete' ? 'sample' : phase.state}</span></button>)}</div>
      <div className="detail-card"><DemoTag>Concept stage · simulated</DemoTag><p className="eyebrow">Step {selected.id} · {selected.eyebrow}</p><h2>{selected.title}</h2><p>{selected.detail}</p><div className="mono-box">{selected.id === 8 ? 'trustRegistry.lookup → simulated\nissuer.status → sample / revocation → not checked' : selected.id === 7 ? 'proof.claim → minimum disclosure\nproof.generation → not implemented' : `holder.did → ${data.holder.did}\ncredential.status → sample only`}</div><span className="micro-note"><LockKeyhole size={14} /> No cryptographic operation is performed in this frontend.</span>
      {selected.actionPath && selected.actionLabel && <div style={{ marginTop: '1.5rem' }}><RouteLink to={selected.actionPath} className="primary-button">{selected.actionLabel} <ArrowUpRight size={15} /></RouteLink></div>}
      </div></div>
  </PageWrap>
}

function WalletPage({ data, onCopy, onReload }: { data: PassportData; onCopy: () => void; onReload: () => void }) {
  const [uploadText, setUploadText] = useState('')
  const [uploadImage, setUploadImage] = useState<string | null>(null)
  const [attachedFile, setAttachedFile] = useState<{
    name: string
    type: string
    size: number
    base64?: string
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const copy = async () => { try { await navigator.clipboard?.writeText(data.holder.did); onCopy() } catch { /* Clipboard support is optional. */ } }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }
  
  const processFile = async (file: File) => {
    setUploadError('')
    setUploadSuccess(false)
    setResetSuccess(false)

    const name = file.name.toLowerCase()
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf')
    const isDocx = file.type.includes('word') || name.endsWith('.docx') || name.endsWith('.doc')
    const isText = file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.csv')

    if (isImage) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setUploadImage(result)
        setAttachedFile({ name: file.name, type: file.type || 'image/png', size: file.size, base64: result })
        setUploadText(`[Image attached: ${file.name}]`)
      }
      reader.onerror = () => setUploadError("Could not read image file.")
      reader.readAsDataURL(file)
    } else if (isPdf || isDocx) {
      // Read as DataURL (base64) so backend can parse the binary PDF or Word document
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setUploadImage(null)
        setAttachedFile({
          name: file.name,
          type: file.type || (isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
          size: file.size,
          base64: result,
        })
        setUploadText(`[Document attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`)
      }
      reader.onerror = () => setUploadError("Could not read document file.")
      reader.readAsDataURL(file)
    } else if (isText) {
      try {
        const text = await file.text()
        setUploadImage(null)
        setAttachedFile({ name: file.name, type: file.type || 'text/plain', size: file.size })
        setUploadText(text)
      } catch {
        setUploadError("Could not read file text.")
      }
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setAttachedFile({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, base64: result })
        setUploadText(`[Document attached: ${file.name}]`)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    await processFile(file)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadText.trim() && !uploadImage && !attachedFile) return
    setUploading(true)
    setUploadError('')
    setUploadSuccess(false)
    try {
      await api.scanDocument(
        uploadText,
        uploadImage ?? undefined,
        attachedFile?.base64,
        attachedFile?.name,
        attachedFile?.type
      )
      setUploadSuccess(true)
      // Do not clear the file from the UI so the user can see what they uploaded
      onReload()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to clear your wallet and reset the demo?")) return
    setUploadError('')
    setUploadSuccess(false)
    setResetSuccess(false)
    try {
      await api.resetWallet()
      setUploadText('')
      setUploadImage(null)
      setAttachedFile(null)
      setResetSuccess(true)
      setTimeout(() => setResetSuccess(false), 4000)
      onReload()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Reset failed')
    }
  }

  return <PageWrap><PageIntro eyebrow="Holder-controlled concept" title="Wallet & credentials." copy="Review the claims included in this demo dataset. These are illustrative records, not credentials issued by the named organizations." />
    
    <section className="glass-panel upload-section">
      <div className="upload-header">
        <div className="upload-icon-box"><UploadCloud size={24} /></div>
        <div>
          <h3>Scan Document or Resume</h3>
          <p>Drag and drop your PDF resume, Word document (.docx), or paste text below. AI will extract your skills and instantly mint them as on-chain verifiable credentials.</p>
        </div>
      </div>
      <form onSubmit={handleScan} className="upload-form">
        
        <div 
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            id="file-upload" 
            className="hidden-file-input" 
            accept=".pdf,.docx,.doc,.txt,.md,.json,.csv,image/*"
            onChange={handleFileChange}
          />
          <label htmlFor="file-upload" className="drop-label">
            <FileText size={28} className="drop-icon" />
            <div className="drop-text">
              <strong>Drag & drop your document or image here</strong>
              <span>Supports PDF (.pdf), Word (.docx), Text (.txt), and Images (.png, .jpg)</span>
            </div>
          </label>
        </div>

        {attachedFile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1rem', background: '#eef6ec', border: '1px solid #c8ddc4', borderRadius: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <FileText size={20} color="#2e5a1c" />
              <div>
                <strong style={{ fontSize: 13, color: '#1a3818' }}>{attachedFile.name}</strong>
                <span style={{ fontSize: 11, color: '#526b4f', marginLeft: 8 }}>({(attachedFile.size / 1024).toFixed(1)} KB) · Ready for AI skill extraction</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setAttachedFile(null); setUploadText(''); setUploadImage(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 12, padding: '4px 8px' }}
            >
              ✕ Remove
            </button>
          </div>
        )}

        {uploadImage && (
          <div style={{ marginBottom: 12, textAlign: 'center' }}>
            <img src={uploadImage} alt="Uploaded certificate" style={{ maxHeight: 150, borderRadius: 8, border: '1px solid #ddd' }} />
          </div>
        )}

        <textarea 
          placeholder="...or paste resume text, project descriptions, or certification details here..." 
          value={uploadText}
          onChange={e => setUploadText(e.target.value)}
          disabled={uploading}
          rows={4}
        />
        <div className="upload-actions">
          {uploadError && <span className="inline-error"><CircleAlert size={14} /> {uploadError}</span>}
          {uploadSuccess && <span className="success-text"><Check size={14} /> Skills minted successfully!</span>}
          {resetSuccess && <span className="success-text" style={{ color: '#2e5a1c' }}><Check size={14} /> Wallet cleared and reset to fresh state!</span>}
          <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
            <button type="button" className="dark-button" onClick={handleReset} style={{ background: '#f0f4ef', color: '#13231f', border: '1px solid #d1dccf' }}>
              Clear / Reset Wallet
            </button>
            <button type="submit" className="primary-button mint-btn" disabled={uploading || (!uploadText.trim() && !uploadImage && !attachedFile)}>
              {uploading ? <><Loader2 className="spinner" size={16} /> Scanning & Minting...</> : <><Sparkles size={16} /> Scan & Mint Skills</>}
            </button>
          </div>
        </div>
      </form>
    </section>

    <div className="detail-grid"><div className="wallet-card">{data.credentials.length ? data.credentials.map((cred) => <article className="credential-card" key={cred.id}><div className="cred-head"><div><strong>{cred.type}</strong><small>Issuer shown for demonstration: {cred.issuer}</small></div><DemoTag>{cred.status}</DemoTag></div><div className="claim-pills">{cred.claims.map((claim) => <span className="claim-pill" key={claim}>{claim}</span>)}</div><span className="micro-note"><KeyRound size={13} /> {cred.issuerDid} · sample expiry {cred.expires}</span></article>) : <EmptyState title="No sample credentials" copy="Upload a document above to scan and mint your skills as on-chain credentials." />}</div>
      <div className="detail-card"><p className="eyebrow">Sample holder identity</p><h2>{data.holder.name}</h2><p>The identifier below is an example string. This frontend does not create a DID or generate a keypair.</p><div className="mono-box">{data.holder.did}<br />network → {data.holder.network}</div><button className="dark-button full" onClick={() => void copy()}>Copy sample identifier <Clipboard size={15} /></button><p className="tiny-note">Clipboard access is local to your browser and only happens when you select the button.</p></div></div>

    <section className="panel vc-panel" style={{ marginTop: '1.5rem' }}>
      <PanelHeader eyebrow="W3C Verifiable Credentials" title="Verified Credentials (VC)" />
      <p style={{ fontSize: 11, color: '#637067', margin: '0 0 1rem', lineHeight: 1.6 }}>Verifiable Credentials are tamper-evident digital certificates that follow the W3C VC Data Model. Each credential is cryptographically signed by its issuer and can be selectively shared with verifiers without revealing your full record.</p>
      {data.credentials.length === 0 ? (
        <EmptyState title="No VCs yet" copy="Scan and mint a document above to generate your first Verifiable Credential on-chain." />
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {data.credentials.map((cred) => (
            <div key={cred.id} style={{ border: '1px solid #ccd4ca', borderRadius: 8, padding: '1rem', background: '#f8faf6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <strong style={{ fontSize: 12, display: 'block' }}>VC · {cred.type}</strong>
                  <small style={{ color: '#637067', fontSize: 10 }}>Issuer DID: {cred.issuerDid}</small>
                </div>
                <span style={{ background: '#d8efbc', color: '#2e5a1c', fontSize: 9, fontFamily: 'var(--mono)', padding: '3px 8px', borderRadius: 10, textTransform: 'uppercase' }}>✓ {cred.status}</span>
              </div>
              <div style={{ fontSize: 10, background: '#edf3e8', border: '1px solid #cddec3', borderRadius: 6, padding: '0.75rem', fontFamily: 'var(--mono)', color: '#405c43', wordBreak: 'break-all' }}>
                @context: https://www.w3.org/2018/credentials/v1<br />
                type: [{cred.type}, VerifiableCredential]<br />
                claims: [{cred.claims.join(', ')}]<br />
                issued: {cred.issued} · expires: {cred.expires}<br />
                proof: blockchain · MST Testnet
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  </PageWrap>
}

function InsightsPage({ data }: { data: PassportData }) {
  const isReal = data.isAiGenerated
  return <PageWrap>
    <PageIntro
      eyebrow={isReal ? `AI-generated · ${data.skills.length} skills detected` : 'Illustrative only · no model connected'}
      title="Skill insights."
      copy={isReal
        ? `Groq AI analysed your ${data.skills.length} verified skill(s) and generated career recommendations and gap analysis below.`
        : 'Upload a document in Wallet & credentials to generate real AI-powered skill insights.'}
    />
    <AccuracyMeter snapshot={calculateAccuracy(data)} />
    <div className="detail-grid">
      <section className="insight-card">
        <PanelHeader eyebrow={isReal ? 'Verified from your document' : 'Sample claims'} title={isReal ? `${data.skills.length} detected skill(s)` : 'Skills in this demo'} />
        <div className="skill-cloud">{data.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
        {!isReal && <div className="mono-box">source → bundled demo credentials<br />AI response → static sample content</div>}
      </section>
      <section className="insight-card">
        <PanelHeader eyebrow="Career exploration" title="Role suggestions" />
        {data.recommendations.map((rec) => (
          <article className="recommendation" key={rec.role}>
            <span className="fit">{rec.fit}</span>
            <strong>{rec.role}</strong>
            <small>{rec.reason}</small>
            {rec.matchingSkills && rec.matchingSkills.length > 0 && (
              <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {rec.matchingSkills.map(s => <span key={s} style={{ background: '#d8efbc', color: '#2e5a1c', fontSize: 9, padding: '2px 7px', borderRadius: 8, fontFamily: 'var(--mono)' }}>{s}</span>)}
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
    <section className="panel gap-panel">
      <PanelHeader
        eyebrow={data.targetRole ? `Target: ${data.targetRole}` : 'Skill gap analysis'}
        title={isReal ? 'Identified skill gaps' : 'Illustrative skill gaps'}
      />
      {data.gaps.length ? data.gaps.map((gap) => (
        <div className="gap-row" key={gap.skill}>
          <strong>{gap.skill}</strong>
          <span className={`priority ${gap.priority.toLowerCase()}`}>{gap.priority}</span>
          <small>{gap.action}</small>
          {gap.explanation && <small style={{ color: '#637067', marginTop: '0.25rem', display: 'block', fontStyle: 'italic' }}>{gap.explanation}</small>}
        </div>
      )) : <EmptyState title="No gap analysis yet" copy="Upload a document to generate AI-powered skill gap analysis." />}
    </section>
  </PageWrap>
}

const CAREER_GOALS = [
  'ML Engineer', 'Data Scientist', 'Data Analyst',
  'Full-stack Developer', 'Frontend Engineer', 'Backend Engineer',
  'DevOps Engineer', 'Platform Engineer', 'Site Reliability Engineer',
  'Blockchain Developer', 'Web3 Full-stack Developer',
  'Software Engineer', 'Technical Analyst', 'Product Engineer',
]

function RoadmapPage({ data, setData, onReload }: { data: PassportData; setData: Dispatch<SetStateAction<PassportData | null>>; onReload: () => void }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [goalInput, setGoalInput] = useState(data.targetRole || '')
  const [goalDraft, setGoalDraft] = useState(data.targetRole || '')

  const noSkills = data.roadmap.length === 1 && data.roadmap[0]?.id === 'no-skills'
  const doneCount = data.roadmap.filter(r => r.status === 'done').length
  const totalCount = noSkills ? 0 : data.roadmap.length
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const toggle = async (id: string) => {
    if (busy || noSkills) return
    const previousRoadmap = data.roadmap
    const nextRoadmap: RoadmapItem[] = previousRoadmap.map((item) =>
      item.id === id ? { ...item, status: item.status === 'done' ? 'next' : 'done' } : item
    )
    setError('')
    setBusy(true)
    setData((cur) => cur ? { ...cur, roadmap: nextRoadmap } : cur)
    try {
      await api.toggleRoadmapItem(id)
      onReload()
    } catch (reason) {
      setData((cur) => cur ? { ...cur, roadmap: previousRoadmap } : cur)
      setError(reason instanceof Error ? reason.message : 'Could not update milestone.')
    } finally { setBusy(false) }
  }

  const handleRegenerate = async () => {
    if (regenerating || noSkills) return
    setRegenerating(true)
    setError('')
    try {
      const result = await api.regenerateRoadmap(goalDraft || undefined)
      setData((cur) => cur ? {
        ...cur,
        roadmap: result.roadmap,
        recommendations: result.recommendations,
        gaps: result.gaps,
        targetRole: result.targetRole,
      } : cur)
      setGoalInput(result.targetRole || '')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not regenerate roadmap.')
    } finally { setRegenerating(false) }
  }

  return <PageWrap>
    <PageIntro
      eyebrow={data.isAiGenerated ? 'AI-generated · personalised to your skills' : 'AI-generated learning path'}
      title="Your personalised roadmap."
      copy={noSkills
        ? 'Scan a certificate or resume in the Wallet page to generate a personalised roadmap based on your actual skills and career goals.'
        : `${totalCount} milestone${totalCount !== 1 ? 's' : ''} tailored to your verified skills${data.targetRole ? ` · targeting ${data.targetRole}` : ''}. Check them off as you complete each one.`}
    />

    {!noSkills && (
      <section className="panel" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Target size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <strong style={{ fontSize: 13 }}>Career goal: {data.targetRole ? <span style={{ color: 'var(--accent)' }}>{data.targetRole}</span> : <span style={{ color: '#8a9e8c', fontStyle: 'italic' }}>not set</span>}</strong>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={goalDraft}
            onChange={e => setGoalDraft(e.target.value)}
            style={{ flex: 1, minWidth: 180, maxWidth: 300, padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #cbd2c9', fontSize: 12, background: '#fff' }}
          >
            <option value="">Select a career goal…</option>
            {CAREER_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <button
            className="primary-button"
            style={{ fontSize: 12, padding: '0.5rem 1rem', gap: '0.4rem' }}
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? <><Loader2 className="spinner" size={14} /> Regenerating…</> : <><RefreshCw size={13} /> Regenerate Roadmap</>}
          </button>
        </div>
        {data.isAiGenerated === false && <p style={{ fontSize: 10, color: '#8a9e8c', margin: '0.5rem 0 0', fontStyle: 'italic' }}>Showing sample milestones. Upload a document to generate real AI roadmap.</p>}
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#637067', marginBottom: '0.3rem' }}>
            <span>{doneCount} of {totalCount} milestones complete</span>
            <strong style={{ color: pct === 100 ? '#2e5a1c' : '#13231f' }}>{pct}%</strong>
          </div>
          <div style={{ height: 6, background: '#e5ece3', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#4ade80' : 'var(--accent)', borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </section>
    )}

    <div className="detail-grid">
      <section className="panel">
        <PanelHeader
          eyebrow={noSkills ? 'No skills scanned yet' : `${totalCount} milestone${totalCount !== 1 ? 's' : ''} · ${doneCount} completed`}
          title={noSkills ? 'Upload to unlock your roadmap' : 'Your learning milestones'}
        />
        {noSkills ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-icon"><Sparkles size={22} /></div>
            <strong>No roadmap yet</strong>
            <p>Go to <RouteLink to="/wallet" style={{ color: 'var(--accent)' }}>Wallet &amp; credentials</RouteLink> and scan a document. The AI will instantly generate a personalised roadmap based on your skills and career gaps.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.roadmap.map((item, idx) => {
              const isExpanded = expandedId === item.id
              return (
                <div
                  key={item.id}
                  style={{
                    border: `1px solid ${item.status === 'done' ? '#c8e6a0' : '#d1dccf'}`,
                    borderRadius: 10,
                    background: item.status === 'done' ? '#f4fbee' : '#fff',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Header row — click to toggle done */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem 1rem' }}>
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={item.status === 'done'}
                      onClick={() => void toggle(item.id)}
                      style={{
                        width: 22, height: 22, borderRadius: 5, flexShrink: 0, marginTop: 1,
                        border: `2px solid ${item.status === 'done' ? '#4ade80' : '#b0c4ae'}`,
                        background: item.status === 'done' ? '#4ade80' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      title={item.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {item.status === 'done' && <Check size={13} color="#fff" strokeWidth={3} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#8a9e8c', fontFamily: 'var(--mono)', fontWeight: 600 }}>0{idx + 1}</span>
                        <strong style={{ fontSize: 13, textDecoration: item.status === 'done' ? 'line-through' : 'none', color: item.status === 'done' ? '#8a9e8c' : '#13231f' }}>{item.title}</strong>
                        {item.skill && <span style={{ background: '#e8f4ff', color: '#1a5fa8', fontSize: 9, padding: '2px 7px', borderRadius: 8, fontFamily: 'var(--mono)', fontWeight: 600 }}>{item.skill}</span>}
                        {item.durationWeeks > 0 && <span style={{ fontSize: 10, color: '#8a9e8c', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} />{item.durationWeeks}w</span>}
                      </div>
                      <p style={{ fontSize: 11, color: '#637067', margin: '0.2rem 0 0', lineHeight: 1.5 }}>{item.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#8a9e8c', flexShrink: 0 }}
                      aria-expanded={isExpanded}
                      title={isExpanded ? 'Collapse' : 'Expand details'}
                    >
                      <ChevronRight size={15} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #e8ede6' }}>
                      {item.why && (
                        <p style={{ fontSize: 11, color: '#405c43', lineHeight: 1.6, margin: '0.75rem 0 0', fontStyle: 'italic', borderLeft: '3px solid var(--accent)', paddingLeft: '0.75rem' }}>
                          💡 {item.why}
                        </p>
                      )}

                      {item.tasks && item.tasks.length > 0 && (
                        <div style={{ marginTop: '0.875rem' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#13231f', margin: '0 0 0.4rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <ListChecks size={12} /> Actionable tasks
                          </p>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {item.tasks.map((task, ti) => (
                              <li key={ti} style={{ fontSize: 11, color: '#405c43', lineHeight: 1.5 }}>{task}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {item.resources && item.resources.length > 0 && (
                        <div style={{ marginTop: '0.875rem' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#13231f', margin: '0 0 0.4rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <ExternalLink size={12} /> Learning resources
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {item.resources.map((res, ri) => (
                              <a
                                key={ri}
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: 11, color: '#1a5fa8', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}
                              >
                                <ExternalLink size={10} style={{ flexShrink: 0 }} />{res.title}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.prerequisites && item.prerequisites.length > 0 && (
                        <p style={{ fontSize: 10, color: '#8a9e8c', margin: '0.75rem 0 0' }}>
                          Prerequisites: {item.prerequisites.join(' → ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {error && <p className="inline-error" role="alert" style={{ marginTop: '0.75rem' }}><CircleAlert size={14} /> {error}</p>}
      </section>

      <div className="detail-card">
        <p className="eyebrow">{noSkills ? 'How it works' : 'Your skill profile'}</p>
        <h2>{noSkills ? 'AI builds your roadmap.' : `${data.skills.length} verified skill${data.skills.length !== 1 ? 's' : ''}.`}</h2>
        {noSkills ? (
          <p>Once you upload a document, Groq AI extracts your skills, identifies career-fit roles, and generates a step-by-step learning roadmap to close the gaps.</p>
        ) : (
          <>
            <div className="skill-cloud" style={{ marginBottom: '1rem' }}>
              {data.skills.map((skill) => <span key={skill}>{skill}</span>)}
            </div>
            {data.gaps.slice(0, 1).map(g => (
              <div key={g.skill} style={{ marginBottom: '0.75rem' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#8a9e8c', margin: '0 0 0.3rem' }}>KEY GAPS TO CLOSE</p>
                {(g.missingSkills || []).map(ms => (
                  <span key={ms} style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', fontSize: 9, padding: '2px 7px', borderRadius: 8, margin: '0 0.25rem 0.25rem 0', fontFamily: 'var(--mono)' }}>{ms}</span>
                ))}
              </div>
            ))}
            <p style={{ fontSize: 11, color: '#637067', lineHeight: 1.5 }}>
              These milestones are tailored to bridge your skill gaps toward your {data.targetRole ? <strong>{data.targetRole}</strong> : 'top career recommendation'}.
            </p>
          </>
        )}
        <div className="mono-box">
          {noSkills ? (
            <>scan document → AI extracts skills<br />AI identifies gaps → roadmap generated</>
          ) : (
            <>skills: {data.skills.slice(0, 3).join(', ')}{data.skills.length > 3 ? ` +${data.skills.length - 3}` : ''}<br />target: {data.targetRole || data.recommendations[0]?.role || 'not set'}<br />progress: {doneCount}/{totalCount} ({pct}%)</>
          )}
        </div>
      </div>
    </div>
  </PageWrap>
}

function SharingPage({ data, setData, onNotice }: { data: PassportData; setData: (data: PassportData) => void; onNotice?: (msg: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let sub = true
    api.getPassport().then((fresh) => {
      if (sub && fresh) setData(fresh)
    }).catch(() => {})
    return () => { sub = false }
  }, [setData])

  const request = data.proofRequest
  const reqSkillLower = (request?.requestedClaim || '').trim().toLowerCase()
  const candidateHasSkill = (data.skills || []).some(
    s => s.toLowerCase() === reqSkillLower || s.toLowerCase().includes(reqSkillLower) || reqSkillLower.includes(s.toLowerCase())
  ) || (data.credentials || []).some(
    c => (c.claims || []).some(cl => cl.toLowerCase() === reqSkillLower || cl.toLowerCase().includes(reqSkillLower) || reqSkillLower.includes(cl.toLowerCase()))
  )

  const decide = async (decision: ProofDecision) => {
    if (!request) return
    if (decision === 'approved' && !candidateHasSkill) {
      setError(`Cannot approve: You do not possess a verified credential for "${request.requestedClaim}" in your wallet.`)
      return
    }
    setBusy(true); setError('')
    try {
      const updated = await api.decideProofRequest(request.id, decision)
      setData({ ...data, proofRequest: updated })
      if (onNotice) {
        onNotice(`Proof request ${decision} successfully.`)
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your choice could not be saved.') }
    finally { setBusy(false) }
  }
  return <PageWrap><PageIntro eyebrow="Consent before disclosure" title="Proof sharing." copy="Inspect the exact claim requested by an employer. You can only approve and share proofs for skills verified in your wallet." />
    {!request ? <section className="sharing-card"><EmptyState title="No requests to review" copy="When a recruiter requests proof of a skill, the request and selective disclosure choices will appear here." /></section> : <section className="sharing-card"><p className="eyebrow">Request · expires {request.expires}</p><h2>{request.from} wants one claim.</h2><p>Role requested: <strong>{request.role}</strong>. You control what is shared.</p>
      {request.status === 'approved' ? <div className="success-state" role="status"><strong><Check size={15} /> Approval recorded.</strong>Proof of “{request.requestedClaim}” has been authorized for the recruiter.</div>
        : request.status === 'declined' ? <div className="declined-state" role="status"><strong>Request declined.</strong>No information was sent. You can reset the request to try the flow again.<button className="outline-button" onClick={() => window.location.reload()}>Reset request <RotateCcw size={14} /></button></div>
          : <><div className="claim-box"><span>They are asking to verify</span><strong>“{request.requestedClaim}”</strong><small>Selective disclosure ensures no full credential or transcript is exposed.</small></div>
            
            {!candidateHasSkill ? (
              <div style={{ padding: '0.85rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, margin: '1rem 0', color: '#991b1b', fontSize: 12, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <CircleAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Missing Verified Credential:</strong> You do not possess a verified credential for “{request.requestedClaim}” in your wallet. You cannot prove or approve a skill you have not verified.
                </div>
              </div>
            ) : (
              <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, margin: '1rem 0', color: '#166534', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Check size={16} />
                <span><strong>Credential Found:</strong> Your wallet holds an active, verified credential for “{request.requestedClaim}”.</span>
              </div>
            )}

            <div className="disclosure"><div className="share"><strong><Check size={14} /> Intended claim to disclose</strong><ul><li>{request.requestedClaim}</li><li>Issuer validity signal (MST Testnet)</li><li>Cryptographic proof hash</li></ul></div><div className="keep"><strong><LockKeyhole size={14} /> Kept private</strong><ul><li>Full credential payload</li><li>Academic grades / transcripts</li><li>Other wallet credentials & activity</li></ul></div></div>
            {error && <p className="inline-error" role="alert"><CircleAlert size={14} /> {error}</p>}
            <div className="share-actions">
              <button
                className="dark-button"
                onClick={() => void decide('approved')}
                disabled={busy || !candidateHasSkill}
                title={!candidateHasSkill ? "You cannot approve a skill not in your wallet" : undefined}
                style={!candidateHasSkill ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                {busy ? 'Saving choice…' : 'Approve proof request'} <ShieldCheck size={15} />
              </button>
              <button className="decline-button" onClick={() => void decide('declined')} disabled={busy}>Decline</button>
            </div>
          </>}
    </section>}
    <section className="panel registry-panel"><PanelHeader eyebrow="Future verification only" title="Checks a backend could perform" />{['Issuer identity is valid', 'Credential has not been revoked', 'Proof is within its expiry window'].map((label) => <div className="registry-row" key={label}><span>{label}</span><span><CircleAlert size={13} /> Not checked in this demo</span></div>)}</section>
  </PageWrap>
}

function GuidePage() {
  const steps = [
    ['01', 'Start with Overview', 'Use the summary cards to open the sample wallet, skill insights, roadmap, or consent request.'],
    ['02', 'Read the accuracy meter', 'It counts exact matches between profile skill names and eligible credential claims; open “How it is calculated” for the rule.'],
    ['03', 'Inspect the evidence', 'The wallet shows fictional credential claims. No real student, university, or issuer account is connected.'],
    ['04', 'Try the sharing flow', 'Review the one requested claim, then approve or decline. The choice changes demo state only; nothing is sent.'],
  ]
  return <PageWrap><PageIntro eyebrow="Start here · 2-minute tour" title="How to use ProofPass." copy="A quick guide to exploring the student-facing passport demo and understanding what its indicators do—and do not—mean." />
    <section className="guide-intro-card"><div><p className="eyebrow">A simple walkthrough</p><h2>Explore the sample. Keep the limits in view.</h2><p>Everything here is fictional demo data. Use the steps below to see how a future student passport could organize evidence and request consent.</p></div><BrandGlyph tone="dark" /></section>
    <div className="guide-grid">{steps.map(([number, title, copy]) => <article className="guide-step" key={number}><span className="guide-step-number">{number}</span><h2>{title}</h2><p>{copy}</p></article>)}</div>
    <div className="notice-band guide-boundary"><CircleAlert size={16} /><p><strong>Important:</strong> This frontend has no live AI, credential verification, wallet, proof generation, registry, or blockchain connection. Do not enter real personal or credential data.</p></div>
  </PageWrap>
}

function AboutPage() {
  const futureSteps = [
    ['Source proof', 'A real provider such as Reclaim or TLSNotary could attest to selected facts from a supported web session.'],
    ['Career layer', 'A server-side AI service could structure permitted claims into skills, suggestions, gaps, and milestones.'],
    ['Trust registry', 'A reviewed contract could record a proof hash and issuer/revocation state without placing raw attributes on-chain.'],
  ]
  return <PageWrap><PageIntro eyebrow="Product information" title="Proof without the paperwork." copy="ProofPass explores a portable skill passport: verify a narrow claim while keeping the rest of a credential private." />
    <section className="about-hero"><p className="eyebrow">The idea</p><h2>Prove what matters. Keep the rest to yourself.</h2><p>Today, sharing a document often means handing over details a verifier never needed. ProofPass is a product concept for a source-backed, claim-level alternative. This frontend demonstrates the intended experience, not the verification technology.</p><RouteLink to="/journey" className="primary-button">Walk through the 12 steps <ArrowUpRight size={15} /></RouteLink></section>
    <section className="future-grid">{futureSteps.map(([title, copy], index) => <article className="future-card" key={title}><span className="phase-marker upcoming">0{index + 1}</span><p className="eyebrow">Possible backend layer</p><h2>{title}</h2><p>{copy}</p><DemoTag>Not connected</DemoTag></article>)}</section>
    <section className="panel seam-panel"><PanelHeader eyebrow="Built for the next integration" title="Frontend now, backend later." /><p>The interface uses typed TypeScript data models and a mock-first API adapter. A future server can implement the documented endpoints without exposing Groq keys, Reclaim secrets, wallet private keys, RPC credentials, or contract-admin secrets to the browser.</p><RouteLink to="/guide" className="inline-link">Read the how-to guide <ArrowUpRight size={14} /></RouteLink></section>
  </PageWrap>
}

function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const privacy = kind === 'privacy'
  return <PageWrap><PageIntro eyebrow="Plain-language notice" title={privacy ? 'Privacy in this demo.' : 'Terms for this demo.'} copy={privacy ? 'This page describes the current frontend behavior. It is not a legal guarantee for a future production service.' : 'Use this prototype to explore a concept. It is not a credential issuer, verification provider, or career-advice service.'} />
    <article className="legal-card"><p className="eyebrow">Last reviewed · 28 September 2026</p>
      {privacy ? <><h2>What is included</h2><p>The student name, identifiers, credentials, request, skills, and roadmap shown in the default demo are fictional sample content bundled with the frontend. They are not fetched from a student, university, or employer account.</p><h2>What this build does</h2><p>When running in mock mode, interactions update local application state for demonstration. This build includes no analytics, account login, credential upload, wallet connection, or backend persistence. The app does not send the sample passport data to an AI provider or blockchain.</p><h2>External requests</h2><p>The interface does not load third-party fonts or make analytics calls. If a future backend URL is configured, the frontend sends the documented API requests to that configured service; the operator must review its privacy practices before using real personal data.</p><h2>Before using real data</h2><p>Replace the sample adapter only after access controls, consent, retention, security, and legal requirements have been designed and reviewed. Do not enter real credentials into this prototype.</p></> : <><h2>Demonstration only</h2><p>This is a frontend prototype with sample data. It does not issue verifiable credentials, create decentralized identifiers or cryptographic keys, generate zero-knowledge proofs, verify a source website, call an AI model, or query a blockchain.</p><h2>No verification or advice</h2><p>Any status, match, suggestion, workflow step, or issuer shown here is simulated. It must not be relied on for hiring, education, identity, compliance, or access decisions. Career suggestions are illustrative and are not professional advice.</p><h2>Future integrations</h2><p>A connected backend, provider, contract, or registry would need its own terms, security review, operational controls, and user notices before real-world use. This frontend intentionally contains no provider secrets.</p><h2>Prototype availability</h2><p>This demonstration is provided for exploration. Sample data and interactions may change; no service-level availability or production verification is represented.</p></>}
    </article>
  </PageWrap>
}

function ContactPage() {
  return <PageWrap><PageIntro eyebrow="Contact" title="A contact channel is not configured." copy="No support email address or contact form was provided for this prototype, so this page does not invent one or collect messages." />
    <section className="contact-card"><div className="empty-icon"><CircleAlert size={20} /></div><h2>Before a public launch</h2><p>Add a monitored support address or a secure contact workflow controlled by the project owner. This demo currently has no message endpoint.</p><span className="micro-note"><LockKeyhole size={14} /> No contact details are collected here.</span></section>
  </PageWrap>
}

function NotFoundPage() {
  return <PageWrap><section className="not-found"><span className="not-found-code">404</span><p className="eyebrow">No route here</p><h1>That page isn’t part of this passport.</h1><p>Check the address or return to the student demo overview.</p><RouteLink to="/" className="dark-button">Back to overview <ArrowUpRight size={15} /></RouteLink></section></PageWrap>
}


function PrivacyPage() { return <LegalPage kind="privacy" /> }
function TermsPage() { return <LegalPage kind="terms" /> }

export default App


function EmployerPage({ data }: { data: PassportData }) {
  const [address, setAddress] = useState('0x1111111111111111111111111111111111111111')
  const [skill, setSkill] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<'verified' | 'unverified' | null>(null)
  const [step, setStep] = useState<'request' | 'pending' | 'result'>('request')
  const [report, setReport] = useState<string | null>(null)
  const [vcData, setVcData] = useState<{ skill: string; issuer: string; issued: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'verify' | 'vc'>('verify')

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.trim() || !skill.trim()) return
    setVerifying(true)
    try {
      await api.requestProof(address, skill)
      setStep('pending')
    } catch { /* ignore */ } finally { setVerifying(false) }
  }

  const handleCheckStatus = useCallback(async () => {
    setVerifying(true)
    try {
      const res = await api.checkProofRequest()
      if (res.status === 'approved') {
        setResult('verified')
        setReport(res.report || `Based on verified credential for "${skill}": The candidate demonstrates strong competency. Recommended for roles requiring ${skill}. Skill level: Intermediate–Advanced based on credential metadata.`)
        setVcData({ skill, issuer: 'did:proofpass:mst:0x1111...1111', issued: new Date().toLocaleDateString('en-IN') })
      } else if (res.status === 'declined') {
        setResult('unverified')
        setVcData(null)
      } else {
        setResult(null); setStep('pending')
      }
      if (res.status !== 'pending') setStep('result')
    } catch { setResult('unverified'); setStep('result') } finally { setVerifying(false) }
  }, [skill])

  useEffect(() => {
    if (step !== 'pending') return
    const interval = setInterval(() => {
      void handleCheckStatus()
    }, 2000)
    return () => clearInterval(interval)
  }, [step, handleCheckStatus])

  return <PageWrap>
    <PageIntro eyebrow="Recruiter portal" title="Candidate Verification" copy="Request proof, verify blockchain credentials, and inspect W3C Verifiable Credentials — all without seeing the candidate's full record." />
    
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
      <button className={`tab-btn ${activeTab === 'verify' ? 'active' : ''}`} onClick={() => setActiveTab('verify')}><ShieldCheck size={14} /> Verify Skill</button>
      <button className={`tab-btn ${activeTab === 'vc' ? 'active' : ''}`} onClick={() => setActiveTab('vc')}><BadgeCheck size={14} /> VC Inspector</button>
    </div>

    {activeTab === 'verify' && (
      <div className="employer-page-grid">
        <section className="panel employer-panel">
          <PanelHeader eyebrow="Verifier workspace" title="Check a specific skill" />
          
          {step === 'request' && (
            <form className="employer-lookup" onSubmit={handleRequest}>
              <label htmlFor="candidate-address">Candidate Wallet Address (DID)</label>
              <input id="candidate-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." required className="employer-input" />
              <label htmlFor="candidate-skill" style={{ marginTop: '16px', display: 'block' }}>Required Skill</label>
              <div className="employer-lookup-row">
                <input id="candidate-skill" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. Python, React, Machine Learning..." required />
                <button className="primary-button mint-btn" type="submit" disabled={verifying}>
                  {verifying ? <Loader2 className="spinner" size={15} /> : <ShieldCheck size={15} />} Request Proof
                </button>
              </div>
              {data.skills && data.skills.length > 0 && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#637067' }}>Candidate's verified skills:</span>
                  {data.skills.slice(0, 6).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSkill(s)}
                      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: skill === s ? '#2e5a1c' : '#eef4ec', color: skill === s ? '#fff' : '#2e5a1c', border: '1px solid #c8ddc4', cursor: 'pointer' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 10, color: '#637067', marginTop: '0.75rem', lineHeight: 1.5 }}>
                This sends a consent request to the candidate's ProofPass wallet. They must approve before you can verify.
              </p>
            </form>
          )}

          {step === 'pending' && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <CircleAlert size={28} style={{ color: '#d97706' }} />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: 16 }}>Consent Request Sent</h3>
              <p style={{ margin: '0 0 0.25rem', fontSize: 12, color: '#555' }}>Waiting for <strong>{address.substring(0,6)}…{address.substring(38)}</strong></p>
              <p style={{ margin: '0 0 1.5rem', fontSize: 11, color: '#888' }}>The candidate can approve or decline in their Proof Sharing portal.</p>
              <button onClick={handleCheckStatus} className="primary-button" disabled={verifying} style={{ gap: '0.5rem' }}>
                {verifying ? <><Loader2 className="spinner" size={15} /> Checking...</> : <><RotateCcw size={14} /> Check Approval Status</>}
              </button>
            </div>
          )}

          {step === 'result' && result && (
            <div>
              <div className={`employer-verification-result ${result}`} role="status">
                <div className="employer-result-heading">
                  {result === 'verified' ? <BadgeCheck size={19} color="#2a4039" /> : <CircleAlert size={19} color="#d93025" />}
                  <strong>{result === 'verified' ? '✓ Verified on Blockchain' : '✗ Not Verified / Declined'}</strong>
                </div>
                <p>{result === 'verified'
                  ? `Candidate holds a valid, consent-approved credential for "${skill}" on MST Testnet.`
                  : `Candidate declined the request or no valid credential found for "${skill}".`}</p>
              </div>

              {result === 'verified' && report && (
                <div style={{ marginTop: '1rem', padding: '1.25rem', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <h4 style={{ margin: '0 0 0.75rem', color: '#166534', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} /> AI Skill Analysis Report
                  </h4>
                  <p style={{ margin: 0, fontSize: 11, color: '#15803d', lineHeight: 1.65 }}>{report}</p>
                </div>
              )}

              {result === 'verified' && vcData && (
                <div style={{ marginTop: '1rem', padding: '1.25rem', borderRadius: 8, background: '#edf3e8', border: '1px solid #cddec3', fontFamily: 'var(--mono)', fontSize: 10, color: '#405c43', lineHeight: 1.7 }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem', fontFamily: 'inherit', color: '#2e5a1c' }}>W3C Verifiable Credential (VC)</strong>
                  @context: https://www.w3.org/2018/credentials/v1<br />
                  type: [SkillCredential, VerifiableCredential]<br />
                  credentialSubject.skill: <strong>{vcData.skill}</strong><br />
                  issuer: {vcData.issuer}<br />
                  issuanceDate: {vcData.issued}<br />
                  proof.type: blockchain · MST Testnet<br />
                  proof.verificationMethod: smart-contract-registry
                </div>
              )}
              <button onClick={() => { setStep('request'); setResult(null); setVcData(null); setReport(null) }} className="outline-button" style={{ marginTop: '1.25rem' }}>Verify Another</button>
            </div>
          )}
        </section>
        
        <div className="detail-card">
          <p className="eyebrow">Privacy-First Design</p>
          <h2>Zero-Knowledge Verification</h2>
          <p>As a recruiter, you only learn whether the claim is valid — not the candidate's full credential, grade, or unrelated skills. The candidate controls what they share.</p>
          <div className="mono-box">
            verifySkill(address, skill)<br/>
            → (isValid, issuer, proofHash)<br/><br/>
            Claim shared: YES/NO only<br/>
            Full credential: NEVER exposed
          </div>
          <p style={{ fontSize: 10, color: '#637067', lineHeight: 1.5, margin: '0.75rem 0 0' }}>
            The candidate approves each request individually. They can decline at any time.
          </p>
        </div>
      </div>
    )}

    {activeTab === 'vc' && (
      <div className="detail-grid">
        <section className="panel">
          <PanelHeader eyebrow="VC Inspector" title="Inspect a Verifiable Credential" />
          <p style={{ fontSize: 11, color: '#637067', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Enter a candidate's address and skill name to pull their W3C Verifiable Credential directly from the blockchain trust registry.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 650, marginBottom: 4 }}>Candidate Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #cbd2c9', fontSize: 11 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 650, marginBottom: 4 }}>Skill / Claim to Inspect</label>
              <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. Python, Machine Learning..." style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #cbd2c9', fontSize: 11 }} />
            </div>
            <button className="primary-button" onClick={async () => {
              if (!address || !skill) return
              setVerifying(true)
              try {
                const isValid = await api.verifySkill(address, skill)
                if (isValid) {
                  setVcData({ skill, issuer: `did:mst:${address.substring(0,8)}`, issued: new Date().toLocaleDateString('en-IN') })
                } else {
                  setVcData(null)
                }
                setResult(isValid ? 'verified' : 'unverified')
              } catch { setResult('unverified') } finally { setVerifying(false) }
            }} disabled={verifying || !address || !skill}>
              {verifying ? <><Loader2 className="spinner" size={14} /> Fetching VC...</> : <><KeyRound size={14} /> Fetch Verifiable Credential</>}
            </button>
          </div>

          {result && (
            <div style={{ marginTop: '1.25rem' }}>
              {result === 'verified' && vcData ? (
                <div style={{ padding: '1.25rem', borderRadius: 8, background: '#edf3e8', border: '1px solid #cddec3' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <strong style={{ fontSize: 13, color: '#2e5a1c' }}>✓ VC Found &amp; Valid</strong>
                    <span style={{ background: '#d8efbc', color: '#2e5a1c', fontSize: 9, padding: '3px 8px', borderRadius: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Blockchain-Verified</span>
                  </div>
                  <pre style={{ margin: 0, fontSize: 10, fontFamily: 'var(--mono)', color: '#405c43', lineHeight: 1.8, whiteSpace: 'pre-wrap', background: '#f0f5ea', padding: '0.75rem', borderRadius: 6, border: '1px solid #c5d8ba' }}>{JSON.stringify({
                    "@context": ["https://www.w3.org/2018/credentials/v1"],
                    "type": ["VerifiableCredential", "SkillCredential"],
                    "issuer": vcData.issuer,
                    "issuanceDate": vcData.issued,
                    "credentialSubject": {
                      "id": address,
                      "skill": vcData.skill,
                      "skillLevel": "verified",
                      "proofType": "BlockchainAttestation"
                    },
                    "proof": {
                      "type": "SmartContractProof",
                      "network": "MST Testnet",
                      "verificationMethod": "contract-registry",
                      "proofPurpose": "assertionMethod"
                    }
                  }, null, 2)}</pre>
                </div>
              ) : (
                <div style={{ padding: '1rem', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 11 }}>
                  <strong>No valid VC found</strong> for skill "{skill}" at this address.
                </div>
              )}
            </div>
          )}
        </section>

        <div className="detail-card">
          <p className="eyebrow">W3C VC Standard</p>
          <h2>What is a Verifiable Credential?</h2>
          <p>A Verifiable Credential (VC) is a tamper-evident digital certificate following the W3C VC Data Model. Each credential is cryptographically bound to its issuer and subject.</p>
          <div className="mono-box">
            Issuer signs → Holder stores<br/>
            Verifier checks → Trust registry<br/><br/>
            No central authority<br/>
            No credential exposure<br/>
            No middlemen
          </div>
          <p style={{ fontSize: 10, color: '#637067', lineHeight: 1.5, margin: '0.75rem 0 0' }}>ProofPass stores credential proofs on-chain. The full credential stays with the holder.</p>
        </div>
      </div>
    )}
  </PageWrap>
}

