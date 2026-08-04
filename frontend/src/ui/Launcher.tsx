import { useState } from 'react'
import { login, register } from '../api/auth'
import { useAuthStore } from '../stores/authStore'

export const GAME_WINDOW_NAME = 'threeKingdomsStory'
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

  const submit = async () => {
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
      <img className="launcher-logo" src="/assets/img/logo/main_logo.png" alt="삼국지 스토리" />
      {launched ? <p className="launcher-running">게임 실행 중…</p> : (
        <section className={'launcher-auth launcher-auth--' + mode}>
          <p className="launcher-kicker">THREE KINGDOMS STORY</p>
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
            <>
              {mode === 'register' && <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="게임에서 보일 이름" maxLength={30} />}
              <input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="로그인 ID" maxLength={30} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 (4자 이상)" type="password" maxLength={72} />
              <button className="launcher-btn" disabled={busy || !loginId || !password || (mode === 'register' && !displayName)} onClick={submit}>
                {mode === 'login' ? '로그인' : '회원가입'}
              </button>
              <button className="launcher-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage('') }}>
                {mode === 'login' ? '처음이신가요? 회원가입' : '이미 계정이 있나요? 로그인'}
              </button>
            </>
          )}
          {message && <p className="launcher-message">{message}</p>}
        </section>
      )}
    </main>
  )
}
