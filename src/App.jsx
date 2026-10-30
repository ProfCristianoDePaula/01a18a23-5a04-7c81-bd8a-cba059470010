import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FileArchive,
  FileCheck2,
  FileText,
  FolderOpen,
  Headphones,
  House,
  LockKeyhole,
  Menu,
  MessageCircleMore,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import './App.css'

const MAX_FILE_SIZE = 500 * 1024 * 1024
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

function apiUrl(path) {
  return `${API_BASE}${path}`
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function JobList({ items, user, onDelete, onNavigate, onLogin }) {
  if (!user) return <div className="empty-documents"><div className="empty-icon"><LockKeyhole size={21} /></div><div><strong>Entre para ver seus documentos</strong><span>Os arquivos gerados são salvos na sua conta.</span></div><button onClick={onLogin}>→</button></div>
  if (!items.length) return <div className="empty-documents"><div className="empty-icon"><FileText size={22} /></div><div><strong>Nenhum documento por enquanto</strong><span>Quando você gerar um Word, ele aparecerá aqui para baixar.</span></div><button aria-label="Adicionar documento" onClick={onNavigate}><Plus size={18} /></button></div>
  return <div className="job-list">{items.map((job) => <article className="job-row" key={job.id}><div className={`job-icon job-${job.status}`}><FileText size={19} /></div><div className="job-copy"><strong>{job.name.replace(/\.zip$/i, '')}_organizado.docx</strong><span>{job.status === 'ready' ? 'Documento pronto' : job.status === 'failed' ? (job.error || 'Falha ao gerar') : job.progress || 'Preparando…'}</span></div><span className={`job-status status-${job.status}`}>{job.status === 'ready' ? 'Pronto' : job.status === 'failed' ? 'Falhou' : 'Em andamento'}</span>{job.status === 'ready' && <a className="job-action" href={apiUrl(job.download_url)} download aria-label="Baixar DOCX"><Download size={17} /></a>}<button className="job-action delete-action" onClick={() => onDelete(job)} aria-label="Apagar documento"><X size={17} /></button></article>)}</div>
}

function App() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [transcriptConsent, setTranscriptConsent] = useState(false)
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [screen, setScreen] = useState('home')
  const [modal, setModal] = useState('')
  const [notice, setNotice] = useState('')
  const [modalNotice, setModalNotice] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [authMode, setAuthMode] = useState('signup')
  const [busy, setBusy] = useState(false)
  const [user, setUser] = useState(null)
  const [jobs, setJobs] = useState([])

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(apiUrl(path), { credentials: 'include', ...options })
    if (!response.ok) {
      let message = `Erro ${response.status}`
      try { message = (await response.json()).detail || message } catch { /* resposta sem JSON */ }
      const error = new Error(message)
      error.status = response.status
      throw error
    }
    return response.status === 204 ? null : response.json()
  }, [])

  const loadAccount = useCallback(async () => {
    try {
      const account = await api('/api/me')
      setUser(account)
      const documents = await api('/api/jobs')
      setJobs(documents)
    } catch {
      setUser(null)
      setJobs([])
    }
  }, [api])

  useEffect(() => {
    const timer = window.setTimeout(loadAccount, 0)
    return () => window.clearTimeout(timer)
  }, [loadAccount])

  useEffect(() => {
    if (!jobs.some((job) => job.status === 'queued' || job.status === 'processing')) return undefined
    const timer = window.setInterval(async () => {
      try { setJobs(await api('/api/jobs')) } catch { /* mantém o último estado conhecido */ }
    }, 2500)
    return () => window.clearInterval(timer)
  }, [api, jobs])

  function acceptFile(candidate) {
    if (!candidate) return
    if (!candidate.name.toLowerCase().endsWith('.zip')) {
      setNotice('Escolha o arquivo ZIP criado ao exportar a conversa do WhatsApp.')
      return
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setNotice('O limite atual do protótipo é 500 MB por arquivo.')
      return
    }
    setFile(candidate)
    setNotice('')
  }

  async function submitJob(event) {
    event.preventDefault()
    if (!file || !privacyConsent) return
    setBusy(true)
    const body = new FormData()
    body.append('archive', file)
    body.append('transcription_consent', String(transcriptConsent))
    body.append('delete_source_after_export', 'true')
    try {
      const result = await api('/api/jobs', { method: 'POST', body })
      setNotice('Arquivo recebido. O documento está sendo preparado; você pode acompanhar o andamento abaixo.')
      setJobs((current) => [{ id: result.id, name: file.name, status: 'queued', progress: 'Na fila', error: null, created_at: new Date().toISOString(), download_url: null }, ...current])
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (error) {
      if (error.status === 401) {
        setAuthMode('signup')
        setModalNotice('Crie uma conta ou entre para guardar e baixar o documento. Depois, envie o ZIP novamente.')
        setModal('auth')
      } else {
        setNotice(error.message || 'Não foi possível enviar o ZIP.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function submitAuth(event) {
    event.preventDefault()
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const endpoint = authMode === 'signup' ? '/api/auth/register' : '/api/auth/login'
    try {
      const account = await api(endpoint, { method: 'POST', body: form })
      setUser(account)
      await loadAccount()
      setNotice(authMode === 'signup' ? 'Conta criada. Agora envie o ZIP para preparar o documento.' : 'Você entrou na plataforma.')
      setModalNotice('')
      setModal('')
    } catch (error) {
      setModalNotice(error.message || 'Não foi possível acessar sua conta.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteJob(job) {
    if (!window.confirm(`Apagar o documento “${job.name}” da sua conta?`)) return
    try {
      await api(`/api/jobs/${job.id}`, { method: 'DELETE' })
      setJobs((current) => current.filter((item) => item.id !== job.id))
    } catch (error) {
      setNotice(error.message || 'Não foi possível apagar o documento.')
    }
  }

  async function signOut() {
    try { await api('/api/auth/logout', { method: 'POST' }) } catch { /* encerra a interface local de qualquer forma */ }
    setUser(null)
    setJobs([])
    setNotice('Você saiu da sua conta.')
  }

  const pageHeading = screen === 'documents' ? 'Meus documentos' : screen === 'plans' ? 'Planos e uso' : 'Novo documento'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><MessageCircleMore size={19} strokeWidth={2.4} /></div>
          <span>Document<span className="brand-dot">AI</span></span>
          <button className="icon-button mobile-close" aria-label="Fechar menu" onClick={() => setMobileNav(false)}><X size={20} /></button>
        </div>

        <div className="workspace-label">ESPAÇO PESSOAL</div>
        <nav className="side-nav" aria-label="Menu principal">
          <button className={screen === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => { setScreen('home'); setMobileNav(false) }}><House size={18} /><span>Início</span></button>
          <button className={screen === 'documents' ? 'nav-item active' : 'nav-item'} onClick={() => { setScreen('documents'); setMobileNav(false) }}><FolderOpen size={18} /><span>Meus documentos</span><span className="nav-count">{jobs.length}</span></button>
          <button className={screen === 'plans' ? 'nav-item active' : 'nav-item'} onClick={() => { setScreen('plans'); setMobileNav(false) }}><Sparkles size={18} /><span>Planos e uso</span></button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-privacy"><ShieldCheck size={17} /><div><strong>Privacidade planejada</strong><span>Originais apagados após o DOCX</span></div></div>
        <button className="nav-item help-link" onClick={() => setModal('help')}><CircleHelp size={18} /><span>Ajuda</span><ArrowRight size={15} className="help-arrow" /></button>
        <div className="profile-row">
          <div className="profile-avatar">{user?.name?.charAt(0)?.toUpperCase() || '?'}</div>
          <div className="profile-copy"><strong>{user?.name || 'Visitante'}</strong><span>{user?.email || 'Acesse sua conta'}</span></div>
          {user ? <button className="logout-button" onClick={signOut}>Sair</button> : <ChevronDown size={16} className="profile-chevron" />}
        </div>
      </aside>

      {mobileNav && <button className="nav-backdrop" aria-label="Fechar menu" onClick={() => setMobileNav(false)} />}

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>Início</span><span className="crumb-slash">/</span><strong>{pageHeading}</strong></div>
          <div className="topbar-actions">
            <span className="secure-pill"><LockKeyhole size={14} /> {user ? 'Conta ativa' : 'Acesso seguro'}</span>
            {!user && <button className="login-button" onClick={() => { setAuthMode('login'); setModalNotice(''); setModal('auth') }}>Entrar</button>}
            {!user && <button className="create-account" onClick={() => { setAuthMode('signup'); setModalNotice(''); setModal('auth') }}>Criar conta <ArrowRight size={15} /></button>}
          </div>
        </header>

        <div className="page-content">
          {screen === 'home' && <>
            <section className="welcome-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> DOCUMENTOS DE CONVERSAS</div>
                <h1>Sua conversa, organizada<br className="desktop-break" /> para seguir adiante.</h1>
                <p className="welcome-copy">Envie uma exportação do WhatsApp e monte um documento Word claro, com mensagens, imagens e transcrições na sequência.</p>
              </div>
              <div className="hero-stamp" aria-hidden="true"><div className="stamp-inner"><FileCheck2 size={29} /><span>EM<br />ORDEM</span></div></div>
            </section>

            <div className="content-grid">
              <section className="upload-card">
                <div className="card-heading">
                  <div><span className="step-kicker">PASSO 1 DE 2</span><h2>Envie a conversa</h2><p>Selecione o ZIP exportado pelo WhatsApp.</p></div>
                  <div className="step-icon"><Upload size={19} /></div>
                </div>

                <form onSubmit={submitJob}>
                  <input ref={inputRef} className="file-input" type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={(e) => acceptFile(e.target.files?.[0])} />
                  {!file ? <button type="button" className={`dropzone ${dragging ? 'dropzone-active' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFile(e.dataTransfer.files?.[0]) }}>
                    <span className="upload-icon-wrap"><FileArchive size={23} /></span>
                    <strong>Arraste seu arquivo ZIP até aqui</strong>
                    <span className="drop-subtitle">ou <span className="text-link">escolha um arquivo</span> no seu dispositivo</span>
                    <span className="file-limit">ZIP • até 500 MB</span>
                  </button> : <div className="selected-file">
                    <div className="file-icon"><FileArchive size={20} /></div>
                    <div className="selected-file-copy"><strong>{file.name}</strong><span>{formatSize(file.size)} · pronto para enviar</span></div>
                    <button type="button" className="remove-file" aria-label="Remover arquivo" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = '' }}><X size={17} /></button>
                    <span className="file-ready"><Check size={15} /></span>
                  </div>}

                  <div className="processing-options">
                  <div className="option-heading"><AudioLines size={17} /><div><strong>Transcrever mensagens de voz</strong><span>Opcional · os áudios serão enviados à OpenAI.</span></div></div>
                    <label className="switch-control"><input type="checkbox" checked={transcriptConsent} onChange={(e) => setTranscriptConsent(e.target.checked)} /><span className="switch-track" /><span className="visually-hidden">Autorizar transcrição externa</span></label>
                  </div>
                  <label className="consent-row"><input type="checkbox" checked={privacyConsent} onChange={(e) => setPrivacyConsent(e.target.checked)} /><span className="custom-check"><Check size={12} /></span><span>Concordo com o <button type="button" className="inline-link" onClick={() => setModal('privacy')}>tratamento dos dados</button> para montar o documento. O ZIP e os áudios serão apagados após a geração.</span></label>
                  <div className="form-foot"><span><LockKeyhole size={14} /> ZIP e áudios excluídos após a geração</span><button type="submit" className="primary-button" disabled={!file || !privacyConsent || busy}>{busy ? 'Enviando…' : 'Preparar documento'} <ArrowRight size={17} /></button></div>
                </form>
                {notice && <div className="notice" role="status">{notice}</div>}
              </section>

              <aside className="side-column">
                <div className="how-card">
                  <div className="how-card-title"><span>COMO FUNCIONA</span><span className="how-dots"><i /><i /><i /></span></div>
                  <div className="how-step"><div className="how-number">01</div><div><strong>Exporte do WhatsApp</strong><span>Escolha “Incluir arquivos de mídia”.</span></div></div>
                  <div className="how-line" />
                  <div className="how-step"><div className="how-number">02</div><div><strong>Revise e autorize</strong><span>Decida se quer transcrever os áudios.</span></div></div>
                  <div className="how-line" />
                  <div className="how-step"><div className="how-number">03</div><div><strong>Baixe seu Word</strong><span>Mensagens, imagens e transcrições em ordem.</span></div></div>
                </div>

                <div className="privacy-card"><div className="privacy-illustration"><ShieldCheck size={27} /><span className="privacy-sparkle">✦</span></div><div><h3>Privacidade desde o início</h3><p>ZIP e arquivos de processamento são apagados quando a geração termina. Você decide quando excluir o DOCX.</p><button onClick={() => setModal('privacy')} className="learn-link">Entenda como cuidamos dos dados <ArrowRight size={14} /></button></div></div>
              </aside>
            </div>

            <section className="recent-section">
              <div className="section-title"><div><h2>Documentos recentes</h2><p>Seus arquivos prontos aparecem aqui.</p></div><button className="subtle-button" onClick={() => setScreen('documents')}>Ver todos <ArrowRight size={15} /></button></div>
              <JobList items={jobs.slice(0, 4)} user={user} onDelete={deleteJob} onNavigate={() => setScreen('home')} onLogin={() => { setAuthMode('login'); setModal('auth') }} />
            </section>
            <footer className="page-footer"><span>DocumentAI · Organização de conversas</span><span>Seus arquivos pertencem a você.</span></footer>
          </>}

          {screen === 'documents' && <section className="secondary-page"><div className="eyebrow"><span className="eyebrow-dot" /> ARQUIVOS GERADOS</div><h1>Meus documentos</h1><p className="welcome-copy">Os documentos Word ficam disponíveis para baixar até você apagá-los.</p><JobList items={jobs} user={user} onDelete={deleteJob} onNavigate={() => setScreen('home')} onLogin={() => { setAuthMode('login'); setModal('auth') }} /></section>}
          {screen === 'plans' && <section className="secondary-page"><div className="eyebrow"><span className="eyebrow-dot" /> PLANOS E USO</div><h1>Simples e transparente.</h1><p className="welcome-copy">Os planos ainda estão sendo definidos. Primeiro, estamos preparando o fluxo seguro de geração dos documentos.</p><div className="plan-preview"><div className="plan-icon"><Sparkles size={21} /></div><div><strong>Um documento por vez</strong><span>Você acompanha cada etapa e sabe quando o arquivo estará pronto.</span></div><span className="coming-soon">EM BREVE</span></div></section>}
        </div>
      </main>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal('') }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Fechar" onClick={() => setModal('')}><X size={19} /></button>
        {modal === 'auth' && <><div className="modal-mark"><MessageCircleMore size={21} /></div><h2 id="modal-title">{authMode === 'signup' ? 'Crie sua conta' : 'Acesse sua conta'}</h2><p>Seus documentos ficam associados ao seu acesso.</p><div className="auth-tabs"><button className={authMode === 'signup' ? 'selected' : ''} onClick={() => { setAuthMode('signup'); setModalNotice('') }}>Criar conta</button><button className={authMode === 'login' ? 'selected' : ''} onClick={() => { setAuthMode('login'); setModalNotice('') }}>Entrar</button></div><form onSubmit={submitAuth} className="auth-form">{authMode === 'signup' && <label>Seu nome<input name="name" placeholder="Como podemos chamar você?" autoComplete="name" required /></label>}<label>E-mail<input name="email" type="email" placeholder="voce@email.com" autoComplete="email" required /></label><label>Senha<input name="password" type="password" placeholder="Mínimo de 8 caracteres" minLength={8} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required /></label><button className="primary-button full-button" type="submit" disabled={busy}>{busy ? 'Aguarde…' : authMode === 'signup' ? 'Criar conta' : 'Entrar'} <ArrowRight size={17} /></button></form>{modalNotice && <div className="notice modal-notice" role="status">{modalNotice}</div>}<div className="modal-secure"><LockKeyhole size={13} /> Seus dados de acesso serão protegidos.</div></>}
        {modal === 'privacy' && <><div className="modal-mark"><ShieldCheck size={21} /></div><h2 id="modal-title">Controle dos seus arquivos</h2><p>O servidor processa o ZIP e os arquivos de mídia para montar o Word.</p><ul className="privacy-list"><li><Check size={15} /> Sem ativar a opção, nenhum áudio é enviado para transcrição.</li><li><Check size={15} /> Se ativar, os áudios serão enviados à OpenAI para transcrição em português.</li><li><Check size={15} /> ZIP, áudios e arquivos temporários são apagados ao terminar o processamento.</li><li><Check size={15} /> O DOCX fica na sua conta até você apagá-lo.</li></ul><p className="privacy-small">Ao ativar a transcrição, você autoriza o envio dos áudios à OpenAI para esse fim. A geração sem transcrição ainda pode incluir no Word as demais mensagens e imagens.</p><button className="primary-button full-button" onClick={() => setModal('')}>Entendi <Check size={17} /></button></>}
        {modal === 'help' && <><div className="modal-mark"><Headphones size={21} /></div><h2 id="modal-title">Como exportar a conversa</h2><p>No WhatsApp, abra a conversa, escolha <strong>Mais → Exportar conversa</strong> e selecione <strong>Incluir arquivos de mídia</strong>. Depois envie o arquivo ZIP aqui.</p><div className="help-tip"><Clock3 size={17} /><span>Conversas com muitos áudios ou imagens podem demorar mais para preparar.</span></div><button className="primary-button full-button" onClick={() => setModal('')}>Entendi <Check size={17} /></button></>}
      </section></div>}
    </div>
  )
}

export default App
