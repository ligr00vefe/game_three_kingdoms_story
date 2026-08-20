import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { login, register } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import { LauncherCommunity } from './LauncherCommunity'
import { LauncherLogo } from './LauncherLogo'

export const GAME_WINDOW_NAME = 'threeKingdomsDefense'
export const GAME_WINDOW_WIDTH = 1280
export const GAME_WINDOW_HEIGHT = 720

function openGameWindow(): boolean {
  const url = location.pathname + '?mode=game'
  const width = Math.min(GAME_WINDOW_WIDTH, screen.availWidth)
  const height = Math.min(GAME_WINDOW_HEIGHT, screen.availHeight)
  const left = Math.max(0, Math.round((screen.availWidth - width) / 2))
  const top = Math.max(0, Math.round((screen.availHeight - height) / 2))
  const features = 'popup=yes,left=' + left + ',top=' + top + ',width=' + width + ',height=' + height + ',resizable=no'
  const win = window.open(url, GAME_WINDOW_NAME, features)
  if (!win) return false
  win.focus()
  return true
}

export function Launcher() {
  const [launched, setLaunched] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const user = useAuthStore((state) => state.user)
  const loginIdInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLCanvasElement>(null)
  const communityRef = useRef<HTMLElement>(null)
  const [communityHidden, setCommunityHidden] = useState(false)

  useEffect(() => {
    if (!loggedIn) loginIdInputRef.current?.focus()
  }, [loggedIn, mode])

  useLayoutEffect(() => {
    const updateCommunityVisibility = () => {
      const logo = logoRef.current?.getBoundingClientRect()
      let community = communityRef.current?.getBoundingClientRect()
      if (!logo || !community || community.width === 0 || community.height === 0) return

      // 기록 카드의 상단을 로고 상단에 맞춰 화면 크기별 여백을 일정하게 유지한다.
      if (window.matchMedia('(min-width: 821px)').matches && communityRef.current) {
        communityRef.current.style.top = `${Math.max(24, logo.top)}px`
        community = communityRef.current.getBoundingClientRect()
      }

      const padding = 8
      const overlaps = logo.left - padding < community.right
        && logo.right + padding > community.left
        && logo.top - padding < community.bottom
        && logo.bottom + padding > community.top
      setCommunityHidden(overlaps)
    }

    updateCommunityVisibility()
    window.addEventListener('resize', updateCommunityVisibility)
    const observer = new ResizeObserver(updateCommunityVisibility)
    if (logoRef.current) observer.observe(logoRef.current)
    if (communityRef.current) observer.observe(communityRef.current)
    return () => {
      window.removeEventListener('resize', updateCommunityVisibility)
      observer.disconnect()
    }
  }, [])

  const submit = async () => {
    if (busy || !loginId || !password || (mode === 'register' && !displayName)) return
    setBusy(true)
    setMessage('')
    try {
      const user = mode === 'login'
        ? await login(loginId, password)
        : await register(loginId, displayName, password)
      useAuthStore.getState().setUser(user)
      if (mode === 'register') {
        setMode('login')
        setPassword('')
        setMessage('회원가입이 완료되었습니다. 로그인해 주세요.')
        return
      }
      setLoggedIn(true)
      setMessage('')
    } catch {
      setMessage(mode === 'login' ? '로그인 정보를 확인해 주세요.' : '가입 정보를 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="launcher">
      <div className="launcher-shell"><div className="launcher-core">
      <LauncherLogo logoRef={logoRef} />
      {launched ? <p className="launcher-running">게임 실행 중…</p> : (
        <section className={'launcher-auth launcher-auth--' + mode}>
          <p className="launcher-kicker">THREE KINGDOMS DEFENSE</p>
          <h1>{mode === 'login' ? '게임에 입장하십시오' : '새 계정을 만드십시오'}</h1>
          <p className="launcher-subtitle">
            {mode === 'login' ? '저장된 장수의 여정을 이어갑니다.' : '로그인 ID와 이름을 정해 여정을 시작합니다.'}
          </p>
          {loggedIn ? (
            <div className="launcher-authenticated">
              <p className="launcher-welcome">{user?.displayName}님, 환영합니다.</p>
              <button className="launcher-start-btn" onClick={() => { if (openGameWindow()) setLaunched(true) }}>게임 시작</button>
            </div>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
              {mode === 'register' && <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="게임에서 보일 이름" maxLength={30} />}
              <input
                ref={loginIdInputRef}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && mode === 'login') {
                    event.preventDefault()
                    passwordInputRef.current?.focus()
                  }
                }}
                placeholder="로그인 ID"
                maxLength={30}
              />
              <input
                ref={passwordInputRef}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 (4자 이상)"
                type="password"
                maxLength={72}
              />
              <button type="submit" className="launcher-btn" disabled={busy || !loginId || !password || (mode === 'register' && !displayName)}>
                {mode === 'login' ? '로그인' : '회원가입'}
              </button>
              <button type="button" className="launcher-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage('') }}>
                {mode === 'login' ? '처음이신가요? 회원가입' : '이미 계정이 있나요? 로그인'}
              </button>
            </form>
          )}
          {message && <p className="launcher-message">{message}</p>}
        </section>
      )}
      </div><LauncherCommunity communityRef={communityRef} hidden={communityHidden} /></div>
    </main>
  )
}
