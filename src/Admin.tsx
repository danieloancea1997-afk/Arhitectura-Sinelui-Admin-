import { useEffect, useState } from 'react'
import logo from './assets/logo.png'

type Message = {
  id: number
  name: string
  phone: string
  email: string
  content: string
  created_at: string
}

type MediaItem = {
  id: number
  title: string
  url: string
}

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001'
const API_BASE = `${API_ORIGIN}/api`
const TOKEN_KEY = 'adminToken'
const MESSAGE_STATUS_KEY = 'messageStatuses'
const ACTIVE_TAB_KEY = 'adminActiveTab'
type MessageStatus = 'unread' | 'read' | 'deleted'

function Admin() {
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [mediaTitle, setMediaTitle] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaEditingId, setMediaEditingId] = useState<number | null>(null)
  const [showMediaForm, setShowMediaForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'messages' | 'media' | null>(null)
  const [activeMessage, setActiveMessage] = useState<Message | null>(null)
  const [messageStatuses, setMessageStatuses] = useState<Record<number, MessageStatus>>(
    {},
  )
  const [messageFilter, setMessageFilter] = useState<
    MessageStatus | 'all'
  >('unread')
  const [messageQuery, setMessageQuery] = useState('')
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([])
  const [deleteConfirmIds, setDeleteConfirmIds] = useState<number[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [messagePage, setMessagePage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) {
      setToken(saved)
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY)
    if (saved === 'messages' || saved === 'media') {
      setActiveTab(saved)
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(MESSAGE_STATUS_KEY)
    if (saved) {
      try {
        setMessageStatuses(JSON.parse(saved) as Record<number, MessageStatus>)
      } catch {
        setMessageStatuses({})
      }
    }
  }, [])

  useEffect(() => {
    setSelectedMessageIds([])
  }, [messageFilter])

  useEffect(() => {
    if (!token) {
      return
    }
    if (!activeTab) {
      setActiveTab('messages')
      return
    }
    localStorage.setItem(ACTIVE_TAB_KEY, activeTab)
  }, [token, activeTab])

  useEffect(() => {
    setMessagePage(1)
  }, [messageFilter, messageQuery])

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setMessages([])
    setMediaItems([])
    setActiveTab(null)
    setActiveMessage(null)
    setShowMediaForm(false)
    setMediaEditingId(null)
  }

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const [messagesRes, mediaRes] = await Promise.all([
          fetch(`${API_BASE}/messages`, {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API_BASE}/media`, {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ])

        if (!messagesRes.ok) {
          throw new Error('Nu am putut incarca mesajele.')
        }
        if (!mediaRes.ok) {
          throw new Error('Nu am putut incarca clipurile.')
        }

        const messagesData = (await messagesRes.json()) as Message[]
        const mediaData = (await mediaRes.json()) as MediaItem[]
        setMessages(messagesData)
        setMediaItems(mediaData)
        setMessageStatuses((prev) => {
          const next = { ...prev }
          messagesData.forEach((message) => {
            if (!next[message.id]) {
              next[message.id] = 'unread'
            }
          })
          localStorage.setItem(MESSAGE_STATUS_KEY, JSON.stringify(next))
          return next
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Eroare necunoscuta.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  useEffect(() => {
    if (!token) {
      return
    }

    const timeoutMs = 10 * 60 * 1000
    let timeoutId: number

    const resetTimer = () => {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        handleLogout()
      }, timeoutMs)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, resetTimer))
    resetTimer()

    return () => {
      window.clearTimeout(timeoutId)
      events.forEach((event) => window.removeEventListener(event, resetTimer))
    }
  }, [token])

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        throw new Error('Parola este gresita.')
      }

      const data = (await res.json()) as { token: string }
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscuta.')
    }
  }

  const updateMessageStatus = (id: number, status: MessageStatus) => {
    setMessageStatuses((prev) => {
      const next = { ...prev, [id]: status }
      localStorage.setItem(MESSAGE_STATUS_KEY, JSON.stringify(next))
      return next
    })
  }

  const updateManyMessageStatus = (ids: number[], status: MessageStatus) => {
    if (ids.length === 0) {
      return
    }
    setMessageStatuses((prev) => {
      const next = { ...prev }
      ids.forEach((id) => {
        next[id] = status
      })
      localStorage.setItem(MESSAGE_STATUS_KEY, JSON.stringify(next))
      return next
    })
  }

  const filteredMessages = [...messages]
    .filter((message) => {
      const status = messageStatuses[message.id] ?? 'unread'
      if (messageFilter === 'all') {
        if (status === 'deleted') {
          return false
        }
      } else if (messageFilter !== status) {
        return false
      }
      if (!messageQuery.trim()) {
        return true
      }
      const query = messageQuery.trim().toLowerCase()
      return (
        message.name.toLowerCase().includes(query) ||
        message.email.toLowerCase().includes(query) ||
        message.phone.toLowerCase().includes(query) ||
        message.content.toLowerCase().includes(query)
      )
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  const messagesPerPage = 6
  const totalMessagePages = Math.max(
    1,
    Math.ceil(filteredMessages.length / messagesPerPage),
  )
  const safeMessagePage = Math.min(messagePage, totalMessagePages)
  const pagedMessages = filteredMessages.slice(
    (safeMessagePage - 1) * messagesPerPage,
    safeMessagePage * messagesPerPage,
  )

  const handleMediaEdit = (item: MediaItem) => {
    setMediaEditingId(item.id)
    setMediaTitle(item.title)
    setMediaUrl(item.url)
    setShowMediaForm(true)
    setActiveTab('media')
  }

  const handleMediaCancel = () => {
    setMediaEditingId(null)
    setMediaTitle('')
    setMediaUrl('')
    setShowMediaForm(false)
  }

  const handleMediaSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!token) {
      return
    }

    try {
      const isEditing = mediaEditingId !== null
      const res = await fetch(
        isEditing ? `${API_BASE}/media/${mediaEditingId}` : `${API_BASE}/media`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: mediaTitle, url: mediaUrl }),
        },
      )

      if (!res.ok) {
        const fallback = isEditing
          ? 'Nu am putut edita clipul.'
          : 'Nu am putut salva clipul.'
        throw new Error(fallback)
      }

      const saved = (await res.json()) as MediaItem
      if (isEditing) {
        setMediaItems((prev) =>
          prev.map((item) => (item.id === saved.id ? saved : item)),
        )
      } else {
        setMediaItems((prev) => [saved, ...prev])
      }
      setMediaTitle('')
      setMediaUrl('')
      setMediaEditingId(null)
      setShowMediaForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscuta.')
    }
  }

  const handleMediaDelete = async (itemId: number) => {
    if (!token) {
      return
    }

    try {
      const res = await fetch(`${API_BASE}/media/${itemId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error('Nu am putut sterge clipul.')
      }

      setMediaItems((prev) => prev.filter((item) => item.id !== itemId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscuta.')
    }
  }

  return (
    <section className={token ? 'adminp-shell' : 'admin-page'}>
      {token ? (
        <div className="adminp-header">
          <div className="adminp-header-inner">
            <div className="adminp-brand">
              <img className="adminp-logo" src={logo} alt="Arhitectura Sinelui" />
              <p className="adminp-title">Arhitectura Sinelui Dashboard</p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      ) : (
        <div className="card auth-card">
          {error && <p className="error">{error}</p>}
          <form className="form" onSubmit={handleLogin}>
            <label className="field">
              <span>Parola admin</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Introdu parola"
                required
              />
            </label>
            <button className="btn" type="submit">
              Intra in admin
            </button>
          </form>
        </div>
      )}

      {token && (
        <div className="adminp-layout">
          <div className="adminp-nav">
            <button
              className={activeTab === 'messages' ? 'adminp-tab active' : 'adminp-tab'}
              type="button"
              onClick={() => {
                setActiveTab('messages')
                setMessageFilter('unread')
              }}
            >
              Mesaje
            </button>
            <button
              className={activeTab === 'media' ? 'adminp-tab active' : 'adminp-tab'}
              type="button"
              onClick={() => setActiveTab('media')}
            >
              Media
            </button>
          </div>

          {activeTab && (
            <aside className="adminp-panel">
              <div className="adminp-content">
                {activeTab === 'messages' && (
                  <div className="stack">
                    <div className="adminp-section">
                      <h2>Mesaje</h2>
                      <div className="row">
                        <select
                          className="adminp-select"
                          value={messageFilter}
                          onChange={(event) =>
                            setMessageFilter(
                              event.target.value as MessageStatus | 'all',
                            )
                          }
                        >
                          <option value="all">Toate mesajele</option>
                          <option value="unread">Mesaje noi</option>
                          <option value="read">Mesaje citite</option>
                          <option value="deleted">Mesaje eliminate</option>
                        </select>
                        {messageFilter !== 'deleted' && (
                          <span className="adminp-badge">{filteredMessages.length}</span>
                        )}
                      </div>
                    </div>
                    <div className="message-toolbar">
                      <input
                        className="adminp-input"
                        type="search"
                        placeholder="Cauta in mesaje"
                        value={messageQuery}
                        onChange={(event) => setMessageQuery(event.target.value)}
                      />
                      {selectedMessageIds.length > 0 && messageFilter !== 'deleted' && (
                        <div className="message-bulk-actions">
                          <span className="muted">
                            {selectedMessageIds.length} selectate
                          </span>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => {
                              updateManyMessageStatus(selectedMessageIds, 'read')
                              setSelectedMessageIds([])
                            }}
                          >
                            Marcheaza citit
                          </button>
                          <button
                            className="btn btn-danger"
                            type="button"
                            onClick={() => {
                              setDeleteConfirmIds(selectedMessageIds)
                              setShowDeleteConfirm(true)
                            }}
                          >
                            Elimina
                          </button>
                        </div>
                      )}
                    </div>
                    {loading && <p className="muted">Se incarca...</p>}
                    {!loading && filteredMessages.length === 0 && (
                      <p className="muted">
                        Nu exista mesaje{' '}
                        {messageFilter === 'unread'
                          ? 'noi'
                          : messageFilter === 'read'
                            ? 'citite'
                            : messageFilter === 'deleted'
                              ? 'eliminate'
                              : ''}
                        .
                      </p>
                    )}
                    {pagedMessages.map((message) => {
                      const preview =
                        message.content.length > 50
                          ? `${message.content.slice(0, 50)}...`
                          : message.content
                      const status = messageStatuses[message.id] ?? 'unread'
                      const isSelected = selectedMessageIds.includes(message.id)
                      return (
                        <article
                          key={message.id}
                          className="card message-card"
                        >
                          <div className="message-check">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedMessageIds((prev) =>
                                  prev.includes(message.id)
                                    ? prev.filter((id) => id !== message.id)
                                    : [...prev, message.id],
                                )
                              }
                            />
                          </div>
                          <div className="message-body">
                            <div className="message-meta">
                              <p className="eyebrow">{message.created_at}</p>
                              {status === 'unread' && (
                                <span className="unread-badge">Necitit</span>
                              )}
                            </div>
                            <p className="muted">{message.email}</p>
                            <p className="article-content muted">{preview}</p>
                          </div>
                          {status === 'deleted' ? (
                            <div className="message-actions">
                              <button
                                className="btn"
                                type="button"
                                onClick={() => updateMessageStatus(message.id, 'unread')}
                              >
                                Restore in mesaje noi
                              </button>
                            </div>
                          ) : (
                            <div className="message-actions">
                              <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={() => {
                                  setActiveMessage(message)
                                  updateMessageStatus(message.id, 'read')
                                }}
                              >
                                Vezi mesajul
                              </button>
                              <button
                                className="btn btn-danger"
                                type="button"
                                onClick={() => {
                                  setDeleteConfirmIds([message.id])
                                  setShowDeleteConfirm(true)
                                }}
                              >
                                Elimina
                              </button>
                            </div>
                          )}
                        </article>
                      )
                    })}
                    {filteredMessages.length > messagesPerPage && (
                      <div className="message-pagination">
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() =>
                            setMessagePage((prev) => Math.max(1, prev - 1))
                          }
                          disabled={safeMessagePage === 1}
                        >
                          Inapoi
                        </button>
                        <span className="muted">
                          Pagina {safeMessagePage} din {totalMessagePages}
                        </span>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() =>
                            setMessagePage((prev) =>
                              Math.min(totalMessagePages, prev + 1),
                            )
                          }
                          disabled={safeMessagePage === totalMessagePages}
                        >
                          Inainte
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'media' && (
                  <div className="stack">
                    <div className="adminp-section">
                      <h2>Media</h2>
                      <div className="row">
                        <span className="adminp-badge">{mediaItems.length}</span>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => {
                            setShowMediaForm(true)
                            setMediaEditingId(null)
                            setMediaTitle('')
                            setMediaUrl('')
                          }}
                          disabled={mediaItems.length >= 9 && mediaEditingId === null}
                        >
                          Adauga clip
                        </button>
                      </div>
                    </div>

                    {mediaItems.length >= 9 && mediaEditingId === null && (
                      <p className="muted">
                        Ai atins limita de 9 clipuri afisate pe home page.
                      </p>
                    )}

                    {showMediaForm && (
                      <form className="card form" onSubmit={handleMediaSave}>
                        <div className="row-between">
                          <h3>{mediaEditingId ? 'Editeaza clip' : 'Clip nou'}</h3>
                          <div className="row">
                            <button
                              className="btn btn-secondary"
                              type="button"
                              onClick={handleMediaCancel}
                            >
                              Renunta
                            </button>
                          </div>
                        </div>
                        <label className="field">
                          <span>Titlu</span>
                          <input
                            className="input"
                            type="text"
                            value={mediaTitle}
                            onChange={(event) => setMediaTitle(event.target.value)}
                            placeholder="Titlul clipului"
                            required
                          />
                        </label>
                        <label className="field">
                          <span>Link YouTube</span>
                          <input
                            className="input"
                            type="url"
                            value={mediaUrl}
                            onChange={(event) => setMediaUrl(event.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            required
                          />
                        </label>
                        <button className="btn" type="submit">
                          {mediaEditingId ? 'Salveaza modificarile' : 'Salveaza clipul'}
                        </button>
                      </form>
                    )}

                    {loading && <p className="muted">Se incarca...</p>}

                    {!loading && mediaItems.length === 0 && (
                      <p className="muted">Inca nu exista clipuri.</p>
                    )}

                    {mediaItems.map((item) => (
                      <article key={item.id} className="card media-card">
                        <div className="row-between">
                          <div>
                            <h3>{item.title}</h3>
                            <p className="muted">{item.url}</p>
                          </div>
                          <div className="row">
                            <button
                              className="btn btn-secondary"
                              type="button"
                              onClick={() => handleMediaEdit(item)}
                            >
                              Editeaza
                            </button>
                            <button
                              className="btn btn-danger"
                              type="button"
                              onClick={() => handleMediaDelete(item.id)}
                            >
                              Sterge
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}

      {activeMessage && (
        <div className="message-modal-overlay" role="presentation">
          <div className="message-modal">
            <div className="row-between">
              <h2>Mesaj complet</h2>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setActiveMessage(null)}
              >
                Inchide
              </button>
            </div>
            <p className="muted">{activeMessage.created_at}</p>
            <p>
              <strong>Nume:</strong> {activeMessage.name}
            </p>
            <p>
              <strong>Email:</strong> {activeMessage.email}
            </p>
            <p>
              <strong>Telefon:</strong> {activeMessage.phone}
            </p>
            <div className="message-content">
              <p>{activeMessage.content}</p>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="message-modal-overlay" role="presentation">
          <div className="message-modal">
            <div className="row-between">
              <h2>Confirmare stergere</h2>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmIds([])
                }}
              >
                Anuleaza
              </button>
            </div>
            <p>
              Sigur vrei sa elimini {deleteConfirmIds.length}{' '}
              {deleteConfirmIds.length === 1 ? 'mesaj' : 'mesaje'}?
            </p>
            <div className="row">
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => {
                  updateManyMessageStatus(deleteConfirmIds, 'deleted')
                  setShowDeleteConfirm(false)
                  setDeleteConfirmIds([])
                  setSelectedMessageIds([])
                }}
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {token && (
        <footer className="admin-footer">
          <p>Fiecare pas conteaza. Continua.</p>
        </footer>
      )}
    </section>
  )
}

export default Admin
