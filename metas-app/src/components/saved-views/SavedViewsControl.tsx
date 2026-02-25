import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Pencil, Pin, PinOff, Plus, Save, Star, Trash2 } from 'lucide-react';

import { Button, Modal } from '../ui';
import { toastError, toastSuccess } from '../../lib/toast';
import {
  type SavedView,
  type SavedViewScope,
  type SavedViewSnapshot,
  createSavedView,
  ensureSingleDefault,
  enforcePinLimit,
  readSavedViews,
  sortSavedViews,
  writeSavedViews,
} from '../../lib/savedViews';

interface SavedViewsControlProps {
  uid?: string;
  scope: SavedViewScope;
  getSnapshot: () => SavedViewSnapshot;
  applySnapshot: (snapshot: SavedViewSnapshot) => void;
  hasExplicitQuery: boolean;
}

type ModalMode = 'create' | 'rename';

const PIN_LIMIT = 5;

export default function SavedViewsControl({
  uid,
  scope,
  getSnapshot,
  applySnapshot,
  hasExplicitQuery,
}: SavedViewsControlProps) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [nameInput, setNameInput] = useState('');
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const defaultAppliedRef = useRef(false);
  const wasOpenRef = useRef(false);

  const views = useMemo(() => {
    void refreshToken;
    return readSavedViews(uid, scope);
  }, [refreshToken, scope, uid]);

  useEffect(() => {
    defaultAppliedRef.current = false;
  }, [scope, uid]);

  useEffect(() => {
    if (defaultAppliedRef.current) return;
    if (hasExplicitQuery) {
      defaultAppliedRef.current = true;
      return;
    }

    const defaultView = views.find((view) => view.isDefault);
    if (!defaultView) {
      defaultAppliedRef.current = true;
      return;
    }

    applySnapshot(defaultView.snapshot);
    defaultAppliedRef.current = true;
  }, [applySnapshot, hasExplicitQuery, views]);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }, [open]);

  const persistViews = useCallback(
    (nextViews: SavedView[]) => {
      const sorted = sortSavedViews(enforcePinLimit(nextViews));
      writeSavedViews(uid, scope, sorted);
      setRefreshToken((value) => value + 1);
    },
    [scope, uid],
  );

  const pinnedCount = useMemo(() => views.filter((view) => view.pinned).length, [views]);

  const closeNameModal = useCallback(() => {
    setModalOpen(false);
    setNameInput('');
    setEditingViewId(null);
  }, []);

  const handleSaveCurrent = useCallback(() => {
    setModalMode('create');
    setNameInput('');
    setEditingViewId(null);
    setModalOpen(true);
  }, []);

  const handleSubmitName = useCallback(() => {
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      toastError('Informe um nome para a visao');
      return;
    }

    const snapshot = getSnapshot();
    if (modalMode === 'create') {
      const newView = createSavedView(scope, trimmedName, snapshot);
      persistViews([newView, ...views]);
      toastSuccess('Visao salva com sucesso');
    } else if (editingViewId) {
      persistViews(
        views.map((view) =>
          view.id === editingViewId
            ? { ...view, name: trimmedName, updatedAt: Date.now() }
            : view,
        ),
      );
      toastSuccess('Visao renomeada');
    }

    closeNameModal();
  }, [closeNameModal, editingViewId, getSnapshot, modalMode, nameInput, persistViews, scope, views]);

  const handleApplyView = useCallback(
    (view: SavedView) => {
      applySnapshot(view.snapshot);
      setOpen(false);
      toastSuccess(`Visao aplicada: ${view.name}`);
    },
    [applySnapshot],
  );

  const handleTogglePin = useCallback(
    (view: SavedView) => {
      if (!view.pinned && pinnedCount >= PIN_LIMIT) {
        toastError('Limite de 5 visoes fixadas atingido');
        return;
      }

      persistViews(
        views.map((item) =>
          item.id === view.id
            ? { ...item, pinned: !item.pinned, updatedAt: Date.now() }
            : item,
        ),
      );
    },
    [persistViews, pinnedCount, views],
  );

  const handleSetDefault = useCallback(
    (view: SavedView) => {
      persistViews(ensureSingleDefault(views, view.id));
      toastSuccess(`Visao padrao definida: ${view.name}`);
    },
    [persistViews, views],
  );

  const handleRename = useCallback((view: SavedView) => {
    setModalMode('rename');
    setEditingViewId(view.id);
    setNameInput(view.name);
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback(
    (view: SavedView) => {
      persistViews(views.filter((item) => item.id !== view.id));
      toastSuccess('Visao excluida');
    },
    [persistViews, views],
  );

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--color-surface)] focus-gold"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
        }}
        aria-label="Abrir visoes salvas"
      >
        <Bookmark className="w-4 h-4" />
        Visoes salvas
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[360px] rounded-xl overflow-hidden shadow-lg animate-fade-in"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            zIndex: 'var(--z-dropdown)',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Visoes salvas
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {scope === 'clients' ? 'Clientes' : 'Prospects'} | {views.length} visao(oes)
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleSaveCurrent}
              aria-label="Salvar visao atual"
            >
              Salvar atual
            </Button>
          </div>

          {views.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Nenhuma visao salva ainda.
              </p>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Save className="w-4 h-4" />}
                onClick={handleSaveCurrent}
                className="mt-2"
              >
                Salvar visao atual
              </Button>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {views.map((view) => (
                <div
                  key={view.id}
                  className="group px-3 py-2 flex items-start justify-between gap-2 transition-colors hover:bg-[var(--row-hover)]"
                  style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                >
                  <button
                    type="button"
                    onClick={() => handleApplyView(view)}
                    className="text-left flex-1 min-w-0"
                  >
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {view.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {view.pinned && <span>Fixada</span>}
                      {view.isDefault && <span>Padrao</span>}
                      <span>Atualizada {new Date(view.updatedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleTogglePin(view)}
                      className="p-1 rounded transition-colors hover-light"
                      title={
                        !view.pinned && pinnedCount >= PIN_LIMIT
                          ? 'Limite de 5 fixadas'
                          : view.pinned
                            ? 'Desafixar visao'
                            : 'Fixar visao'
                      }
                      aria-label={view.pinned ? 'Desafixar visao' : 'Fixar visao'}
                    >
                      {view.pinned ? (
                        <PinOff className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                      ) : (
                        <Pin className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetDefault(view)}
                      className="p-1 rounded transition-colors hover-light"
                      title="Definir como padrao"
                      aria-label="Definir como padrao"
                    >
                      <Star className="w-4 h-4" style={{ color: view.isDefault ? 'var(--color-gold)' : 'var(--color-text-muted)' }} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRename(view)}
                      className="p-1 rounded transition-colors hover-light"
                      title="Renomear visao"
                      aria-label="Renomear visao"
                    >
                      <Pencil className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(view)}
                      className="p-1 rounded transition-colors hover-light"
                      title="Excluir visao"
                      aria-label="Excluir visao"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeNameModal}
        title={modalMode === 'create' ? 'Salvar visao atual' : 'Renomear visao'}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Nome da visao
            </label>
            <input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSubmitName();
                }
              }}
              placeholder="Ex: Ativos com reuniao"
              className="w-full px-3 py-2 rounded-lg focus-gold"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeNameModal}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSubmitName}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
